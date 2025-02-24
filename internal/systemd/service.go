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

func (s *SystemdService) GetUnitDetails(name string) (*types.SystemdServiceDetails, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	// Get basic unit information
	units, err := s.conn.ListUnitsContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to list units: %w", err)
	}

	var unit dbus.UnitStatus
	found := false
	for _, u := range units {
		if u.Name == name {
			unit = u
			found = true
			break
		}
	}

	if !found {
		return nil, fmt.Errorf("service %s not found", name)
	}

	// Get basic metrics
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

	// Get additional properties
	props, err := s.conn.GetAllPropertiesContext(ctx, name)
	if err != nil {
		return nil, fmt.Errorf("failed to get service properties: %w", err)
	}

	// Extract property values with safe type assertions
	mainPID := uint32(0)
	if v, ok := props["MainPID"].(uint32); ok {
		mainPID = v
	}

	tasksMax := uint32(0)
	if v, ok := props["TasksMax"].(uint64); ok {
		tasksMax = uint32(v)
	}

	tasks := uint32(0)
	if v, ok := props["TasksCurrent"].(uint64); ok {
		tasks = uint32(v)
	}

	invocationID := ""
	if v, ok := props["InvocationID"].(string); ok {
		invocationID = v
	}

	dropInPaths := []string{}
	if v, ok := props["DropInPaths"].([]string); ok {
		dropInPaths = v
	}

	triggeredBy := []string{}
	if v, ok := props["TriggeredBy"].([]string); ok {
		triggeredBy = v
	}

	docs := []string{}
	if v, ok := props["Documentation"].([]string); ok {
		docs = v
	}

	mainProcess := ""
	if mainPID > 0 {
		if execStart, ok := props["ExecStart"].(string); ok {
			mainProcess = execStart
		}
	}

	since := ""
	if v, ok := props["ActiveEnterTimestamp"].(uint64); ok {
		since = time.Unix(int64(v/1000000), 0).Format(time.RFC3339)
	}

	ipIn, ipOut := uint64(0), uint64(0)
	if v, ok := props["IPIngressBytes"].(uint64); ok {
		ipIn = v
	}
	if v, ok := props["IPEgressBytes"].(uint64); ok {
		ipOut = v
	}

	ioRead, ioWrite := uint64(0), uint64(0)
	if v, ok := props["IOReadBytes"].(uint64); ok {
		ioRead = v
	}
	if v, ok := props["IOWriteBytes"].(uint64); ok {
		ioWrite = v
	}

	memoryPeak := uint64(0)
	if v, ok := props["MemoryHigh"].(uint64); ok {
		memoryPeak = v
	}

	cpuTime := uint64(0)
	if v, ok := props["CPUUsageNSec"].(uint64); ok {
		cpuTime = v
	}

	cgroup := ""
	if v, ok := props["ControlGroup"].(string); ok {
		cgroup = v
	}

	fragmentPath := ""
	if v, ok := props["FragmentPath"].(string); ok {
		fragmentPath = v
	}

	details := &types.SystemdServiceDetails{
		Service: types.SystemdService{
			Name:        unit.Name,
			Description: unit.Description,
			LoadState:   unit.LoadState,
			ActiveState: unit.ActiveState,
			SubState:    unit.SubState,
			CPUUsage:    metrics.CPUUsage,
			MemoryUsage: metrics.MemoryUsage,
		},
		Unit:        fmt.Sprintf("%s - %s", unit.Name, unit.Description),
		Loaded:      fmt.Sprintf("%s (%s)", unit.LoadState, fragmentPath),
		DropIn:      dropInPaths,
		Since:       since,
		Invocation:  invocationID,
		TriggeredBy: triggeredBy,
		Docs:        docs,
		MainPID:     mainPID,
		MainProcess: mainProcess,
		IP:          fmt.Sprintf("%dB in, %dB out", ipIn, ipOut),
		IO:          fmt.Sprintf("%dB read, %dB written", ioRead, ioWrite),
		Tasks:       tasks,
		TasksLimit:  tasksMax,
		MemoryPeak:  memoryPeak,
		CPUTime:     fmt.Sprintf("%dns", cpuTime),
		CGroup:      cgroup,
	}

	return details, nil
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

func (s *SystemdService) StartUnit(name string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	ch := make(chan string)
	_, err := s.conn.StartUnitContext(ctx, name, "replace", ch)
	if err != nil {
		return fmt.Errorf("failed to start unit: %w", err)
	}

	// Wait for job completion
	result := <-ch
	if result != "done" {
		return fmt.Errorf("failed to start unit: job result was %s", result)
	}

	return nil
}

func (s *SystemdService) StopUnit(name string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	ch := make(chan string)
	_, err := s.conn.StopUnitContext(ctx, name, "replace", ch)
	if err != nil {
		return fmt.Errorf("failed to stop unit: %w", err)
	}

	// Wait for job completion
	result := <-ch
	if result != "done" {
		return fmt.Errorf("failed to stop unit: job result was %s", result)
	}

	return nil
}

func (s *SystemdService) RestartUnit(name string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	ch := make(chan string)
	_, err := s.conn.RestartUnitContext(ctx, name, "replace", ch)
	if err != nil {
		return fmt.Errorf("failed to restart unit: %w", err)
	}

	// Wait for job completion
	result := <-ch
	if result != "done" {
		return fmt.Errorf("failed to restart unit: job result was %s", result)
	}

	return nil
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
