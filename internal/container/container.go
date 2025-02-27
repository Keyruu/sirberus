package container

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	"github.com/Keyruu/sirberus/internal/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/client"
)

type ContainerService struct {
	logger     *slog.Logger
	dockerHost string
}

func NewContainerService(logger *slog.Logger) *ContainerService {
	dockerHost := os.Getenv("DOCKER_HOST")
	if dockerHost == "" {
		if _, err := os.Stat("/var/run/docker.sock"); err == nil {
			dockerHost = "unix:///var/run/docker.sock"
		} else if _, err := os.Stat("/run/podman/podman.sock"); err == nil {
			dockerHost = "unix:///run/podman/podman.sock"
		} else if _, err := os.Stat("/run/user/1000/podman/podman.sock"); err == nil {
			dockerHost = "unix:///run/user/1000/podman/podman.sock"
		}
	}

	return &ContainerService{
		logger:     logger.With("component", "container_service"),
		dockerHost: dockerHost,
	}
}

func (s *ContainerService) createClient(ctx context.Context) (*client.Client, error) {
	opts := []client.Opt{
		client.WithAPIVersionNegotiation(),
	}

	if s.dockerHost != "" {
		opts = append(opts, client.WithHost(s.dockerHost))
	}

	cli, err := client.NewClientWithOpts(opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to create Docker client: %w", err)
	}

	if _, err := cli.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to connect to Docker daemon: %w", err)
	}

	return cli, nil
}

func (s *ContainerService) ListContainers(ctx context.Context) (types.ContainerList, error) {
	cli, err := s.createClient(ctx)
	if err != nil {
		return types.ContainerList{}, err
	}
	defer cli.Close()

	s.logger.Debug("connected to container runtime", "host", s.dockerHost)

	opts := container.ListOptions{
		All:     true,
		Filters: filters.NewArgs(),
	}

	containers, err := cli.ContainerList(ctx, opts)
	if err != nil {
		return types.ContainerList{}, fmt.Errorf("failed to list containers: %w", err)
	}

	result := make([]types.Container, 0, len(containers))
	for _, c := range containers {
		inspect, err := cli.ContainerInspect(ctx, c.ID)
		if err != nil {
			s.logger.Warn("failed to inspect container", "error", err, "id", c.ID)
			continue
		}

		ports := formatPorts(c.Ports)

		createdTime := time.Unix(0, 0)
		if t, err := time.Parse(time.RFC3339, inspect.Created); err == nil {
			createdTime = t
		} else {
			s.logger.Warn("failed to parse container creation time", "error", err, "created", inspect.Created)
		}

		// Get CPU and memory stats if container is running
		cpuUsage := float64(0)
		memoryUsage := uint64(0)

		if inspect.State.Running {
			stats, err := cli.ContainerStats(ctx, c.ID, false)
			if err != nil {
				s.logger.Warn("failed to get container stats", "error", err, "id", c.ID)
			} else {
				defer stats.Body.Close()

				var statsResp container.StatsResponse
				if err := json.NewDecoder(stats.Body).Decode(&statsResp); err != nil {
					s.logger.Warn("failed to decode container stats", "error", err, "id", c.ID)
				} else {
					cpuDelta := float64(statsResp.CPUStats.CPUUsage.TotalUsage - statsResp.PreCPUStats.CPUUsage.TotalUsage)
					systemDelta := float64(statsResp.CPUStats.SystemUsage - statsResp.PreCPUStats.SystemUsage)

					if systemDelta > 0 && cpuDelta > 0 {
						cpuUsage = cpuDelta
					}

					memoryUsage = statsResp.MemoryStats.Usage
				}
			}
		}

		container := types.Container{
			ID:          c.ID[:12], // Short ID
			Name:        strings.TrimPrefix(inspect.Name, "/"),
			Image:       c.Image,
			Command:     fmt.Sprintf("%s %s", inspect.Path, strings.Join(inspect.Args, " ")),
			Created:     createdTime,
			Status:      c.Status,
			Ports:       ports,
			IsRunning:   inspect.State.Running,
			CPUUsage:    cpuUsage,
			MemoryUsage: memoryUsage,
		}

		result = append(result, container)
	}

	return types.ContainerList{
		Containers: result,
		Count:      len(result),
	}, nil
}

func formatPorts(ports []container.Port) string {
	if len(ports) == 0 {
		return ""
	}

	var portStrings []string
	for _, p := range ports {
		if p.PublicPort != 0 {
			portStrings = append(portStrings, fmt.Sprintf("%s:%d->%d/%s", p.IP, p.PublicPort, p.PrivatePort, p.Type))
		} else {
			portStrings = append(portStrings, fmt.Sprintf("%d/%s", p.PrivatePort, p.Type))
		}
	}

	return strings.Join(portStrings, ", ")
}
