package systemd

import (
	"context"
	"fmt"
	"log/slog"
	"runtime"
	"strings"
	"time"

	"github.com/Keyruu/sirberus/internal/types"
	"github.com/coreos/go-systemd/v22/dbus"
)

type SystemdService struct {
	conn   *dbus.Conn
	logger *slog.Logger
}

func NewSystemdService(logger *slog.Logger) (*SystemdService, error) {
	if runtime.GOOS != "linux" {
		return nil, fmt.Errorf("systemd is only supported on Linux")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err := dbus.NewWithContext(ctx)
	if err != nil {
		logger.Error("failed to connect to systemd", "error", err)
		return nil, fmt.Errorf("failed to connect to systemd: %w", err)
	}

	return &SystemdService{
		conn:   conn,
		logger: logger.With("component", "systemd_service"),
	}, nil
}

func (s *SystemdService) Close() {
	if s.conn != nil {
		s.conn.Close()
	}
}

func (s *SystemdService) ListUnits() (*types.SystemdServiceList, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	units, err := s.conn.ListUnitsContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list units: %w", err)
	}

	services := make([]types.SystemdService, 0, len(units))
	for _, unit := range units {
		if !strings.HasSuffix(unit.Name, ".service") {
			continue
		}

		metrics := &ServiceMetrics{
			CPUUsage:    0,
			MemoryUsage: 0,
		}

		if unit.SubState == "running" {
			if m, err := s.getServiceMetrics(ctx, unit.Name); err != nil {
				s.logger.Error("failed to get service metrics",
					"service", unit.Name,
					"error", err)
			} else {
				metrics = m
			}
		}

		service := types.SystemdService{
			Name:        unit.Name,
			Description: unit.Description,
			LoadState:   unit.LoadState,
			ActiveState: unit.ActiveState,
			SubState:    unit.SubState,
			CPUUsage:    metrics.CPUUsage,
			MemoryUsage: metrics.MemoryUsage,
		}

		services = append(services, service)
	}

	return &types.SystemdServiceList{
		Services: services,
		Count:    len(services),
	}, nil
}

type ServiceMetrics struct {
	CPUUsage    float64
	MemoryUsage uint64
}

func (s *SystemdService) getServiceMetrics(ctx context.Context, unitName string) (*ServiceMetrics, error) {
	cpuProp, err := s.conn.GetServicePropertyContext(ctx, unitName, "CPUUsageNSec")
	if err != nil {
		return nil, fmt.Errorf("failed to get CPU usage: %w", err)
	}

	memProp, err := s.conn.GetServicePropertyContext(ctx, unitName, "MemoryCurrent")
	if err != nil {
		return nil, fmt.Errorf("failed to get memory usage: %w", err)
	}

	// Extract values from properties
	cpuNs, ok := cpuProp.Value.Value().(uint64)
	if !ok {
		return nil, fmt.Errorf("invalid CPU usage value type")
	}

	memBytes, ok := memProp.Value.Value().(uint64)
	if !ok {
		return nil, fmt.Errorf("invalid memory usage value type")
	}

	cpuUsage := float64(cpuNs) / 1000000000.0

	return &ServiceMetrics{
		CPUUsage:    cpuUsage,
		MemoryUsage: memBytes,
	}, nil
}
