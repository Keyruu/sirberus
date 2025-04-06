package container

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"os"
	"strconv"
	"strings"
	"time"

	"github.com/Keyruu/sirberus/internal/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
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

func (s *ContainerService) GetContainerDetails(ctx context.Context, id string) (types.Container, error) {
	cli, err := s.createClient(ctx)
	if err != nil {
		return types.Container{}, err
	}
	defer cli.Close()

	inspect, err := cli.ContainerInspect(ctx, id)
	if err != nil {
		return types.Container{}, fmt.Errorf("failed to inspect container: %w", err)
	}

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
		stats, err := cli.ContainerStats(ctx, id, false)
		if err != nil {
			s.logger.Warn("failed to get container stats", "error", err, "id", id)
		} else {
			defer stats.Body.Close()

			var statsResp container.StatsResponse
			if err := json.NewDecoder(stats.Body).Decode(&statsResp); err != nil {
				s.logger.Warn("failed to decode container stats", "error", err, "id", id)
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

	// Convert Docker mounts to our Mount type
	mounts := make([]types.Mount, 0, len(inspect.Mounts))
	for _, m := range inspect.Mounts {
		mode := "rw"
		if m.RW == false {
			mode = "ro"
		}
		mounts = append(mounts, types.Mount{
			Source:      m.Source,
			Destination: m.Destination,
			Mode:        mode,
		})
	}

	// Convert Docker networks to our NetworkConfig type
	networks := make(map[string]types.NetworkConfig)
	for name, net := range inspect.NetworkSettings.Networks {
		networks[name] = types.NetworkConfig{
			IPAddress:  net.IPAddress,
			Gateway:    net.Gateway,
			MacAddress: net.MacAddress,
		}
	}

	// Convert nat.PortMap to []container.Port and format
	ports := formatPorts(convertPortMap(inspect.NetworkSettings.Ports))

	return types.Container{
		ID:          id[:12], // Short ID
		Name:        strings.TrimPrefix(inspect.Name, "/"),
		Image:       inspect.Config.Image,
		Command:     fmt.Sprintf("%s %s", inspect.Path, strings.Join(inspect.Args, " ")),
		Created:     createdTime,
		Status:      inspect.State.Status,
		Ports:       ports,
		IsRunning:   inspect.State.Running,
		CPUUsage:    cpuUsage,
		MemoryUsage: memoryUsage,
		Mounts:      mounts,
		Networks:    networks,
		Labels:      inspect.Config.Labels,
		Environment: inspect.Config.Env,
	}, nil
}

// convertPortMap converts nat.PortMap to []container.Port
func convertPortMap(portMap nat.PortMap) []container.Port {
	var ports []container.Port
	for port, bindings := range portMap {
		if len(bindings) == 0 {
			// Port is exposed but not published
			privatePort, _ := strconv.ParseUint(port.Port(), 10, 16)
			ports = append(ports, container.Port{
				PrivatePort: uint16(privatePort),
				Type:        port.Proto(),
			})
		} else {
			// Port is published
			for _, binding := range bindings {
				privatePort, _ := strconv.ParseUint(port.Port(), 10, 16)
				publicPort, _ := strconv.ParseUint(binding.HostPort, 10, 16)
				ports = append(ports, container.Port{
					IP:          binding.HostIP,
					PrivatePort: uint16(privatePort),
					PublicPort:  uint16(publicPort),
					Type:        port.Proto(),
				})
			}
		}
	}
	return ports
}

func (s *ContainerService) StartContainer(ctx context.Context, id string) error {
	cli, err := s.createClient(ctx)
	if err != nil {
		return err
	}
	defer cli.Close()

	options := container.StartOptions{}
	return cli.ContainerStart(ctx, id, options)
}

func (s *ContainerService) StopContainer(ctx context.Context, id string) error {
	cli, err := s.createClient(ctx)
	if err != nil {
		return err
	}
	defer cli.Close()

	timeoutSeconds := 10
	return cli.ContainerStop(ctx, id, container.StopOptions{Timeout: &timeoutSeconds})
}

func (s *ContainerService) RestartContainer(ctx context.Context, id string) error {
	cli, err := s.createClient(ctx)
	if err != nil {
		return err
	}
	defer cli.Close()

	timeoutSeconds := 10
	return cli.ContainerRestart(ctx, id, container.StopOptions{Timeout: &timeoutSeconds})
}

func (s *ContainerService) StreamContainerLogs(ctx context.Context, id string, follow bool, numLines int) (<-chan string, <-chan error) {
	logCh := make(chan string)
	errCh := make(chan error, 1)

	go func() {
		defer close(logCh)
		defer close(errCh)

		cli, err := s.createClient(ctx)
		if err != nil {
			errCh <- err
			return
		}
		defer cli.Close()

		options := container.LogsOptions{
			ShowStdout: true,
			ShowStderr: true,
			Follow:     follow,
			Tail:       strconv.Itoa(numLines),
			Timestamps: true,
		}

		logs, err := cli.ContainerLogs(ctx, id, options)
		if err != nil {
			errCh <- fmt.Errorf("failed to get container logs: %w", err)
			return
		}
		defer logs.Close()

		// Process logs and send to channel
		scanner := bufio.NewScanner(logs)
		for scanner.Scan() {
			line := scanner.Text()
			select {
			case logCh <- line:
			case <-ctx.Done():
				return
			}
		}

		if err := scanner.Err(); err != nil {
			errCh <- fmt.Errorf("error reading logs: %w", err)
		}
	}()

	return logCh, errCh
}

func (s *ContainerService) ExecInContainer(ctx context.Context, id string, command string) (<-chan string, <-chan error) {
	outputCh := make(chan string)
	errCh := make(chan error, 1)

	go func() {
		defer close(outputCh)
		defer close(errCh)

		cli, err := s.createClient(ctx)
		if err != nil {
			errCh <- err
			return
		}
		defer cli.Close()

		// Split command into command and args
		cmdParts := strings.Fields(command)
		if len(cmdParts) == 0 {
			errCh <- fmt.Errorf("empty command")
			return
		}

		// Create exec configuration
		execConfig := container.ExecOptions{
			Cmd:          cmdParts,
			AttachStdout: true,
			AttachStderr: true,
			Tty:          false,
		}

		// Create exec instance
		execID, err := cli.ContainerExecCreate(ctx, id, execConfig)
		if err != nil {
			errCh <- fmt.Errorf("failed to create exec: %w", err)
			return
		}

		// Attach to exec instance
		resp, err := cli.ContainerExecAttach(ctx, execID.ID, container.ExecStartOptions{})
		if err != nil {
			errCh <- fmt.Errorf("failed to attach to exec: %w", err)
			return
		}
		defer resp.Close()

		// Start exec instance
		err = cli.ContainerExecStart(ctx, execID.ID, container.ExecStartOptions{})
		if err != nil {
			errCh <- fmt.Errorf("failed to start exec: %w", err)
			return
		}

		// Monitor exec status in a separate goroutine
		go func() {
			for {
				select {
				case <-ctx.Done():
					return
				default:
					inspectResp, err := cli.ContainerExecInspect(ctx, execID.ID)
					if err != nil {
						errCh <- fmt.Errorf("failed to inspect exec: %w", err)
						return
					}

					if inspectResp.Running == false {
						if inspectResp.ExitCode != 0 {
							errCh <- fmt.Errorf("command '%s' exited with code %d", command, inspectResp.ExitCode)
						}
						return
					}

					time.Sleep(100 * time.Millisecond)
				}
			}
		}()

		// Stream output
		scanner := bufio.NewScanner(resp.Reader)
		for scanner.Scan() {
			line := scanner.Text()
			select {
			case outputCh <- line:
			case <-ctx.Done():
				return
			}
		}

		if err := scanner.Err(); err != nil {
			errCh <- fmt.Errorf("error reading exec output: %w", err)
		}
	}()

	return outputCh, errCh
}
