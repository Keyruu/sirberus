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
	logger *slog.Logger
}

func NewSystemdService(logger *slog.Logger) (*SystemdService, error) {
	if runtime.GOOS != "linux" {
		return nil, fmt.Errorf("systemd is only supported on Linux")
	}

	return &SystemdService{
		logger: logger.With("component", "systemd_service"),
	}, nil
}

func (s *SystemdService) newConnection(ctx context.Context) (*dbus.Conn, error) {
	conn, err := dbus.NewWithContext(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to systemd: %w", err)
	}
	return conn, nil
}

func (s *SystemdService) GetUnitDetails(name string) (*types.SystemdServiceDetails, error) {
	ctx, cancel := context.WithTimeout(context.Background(), defaultUnitTimeout)
	defer cancel()

	conn, err := s.newConnection(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	units, err := conn.ListUnitsContext(ctx)
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

	props, err := conn.GetAllPropertiesContext(ctx, name)
	if err != nil {
		return nil, fmt.Errorf("failed to get service properties: %w", err)
	}

	// Extract properties using helper functions
	mainPID := getUint32Property(props, "MainPID")
	tasksMax := getUint32Property(props, "TasksMax")
	tasks := getUint32Property(props, "TasksCurrent")

	invocationID := getStringProperty(props, "InvocationID")
	dropInPaths := getStringArrayProperty(props, "DropInPaths")
	triggeredBy := getStringArrayProperty(props, "TriggeredBy")
	docs := getStringArrayProperty(props, "Documentation")

	mainProcess := ""
	if mainPID > 0 {
		mainProcess = getStringProperty(props, "ExecStart")
	}

	since := ""
	if timestamp := getUint64Property(props, "ActiveEnterTimestamp"); timestamp > 0 {
		seconds := int64(timestamp / microsecondsPerSecond)
		since = time.Unix(seconds, 0).Format(time.RFC3339)
	}

	ipIn := getUint64Property(props, "IPIngressBytes")
	ipOut := getUint64Property(props, "IPEgressBytes")
	ioRead := getUint64Property(props, "IOReadBytes")
	ioWrite := getUint64Property(props, "IOWriteBytes")
	memoryPeak := getUint64Property(props, "MemoryHigh")
	cpuTime := getUint64Property(props, "CPUUsageNSec")

	cgroup := getStringProperty(props, "ControlGroup")
	fragmentPath := getStringProperty(props, "FragmentPath")

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
		DropIn:         dropInPaths,
		Since:          since,
		Invocation:     invocationID,
		TriggeredBy:    triggeredBy,
		Docs:           docs,
		MainPID:        mainPID,
		MainProcess:    mainProcess,
		IPIngressBytes: ipIn,
		IPEgressBytes:  ipOut,
		IOReadBytes:    ioRead,
		IOWriteBytes:   ioWrite,
		Tasks:          tasks,
		TasksLimit:     tasksMax,
		MemoryPeak:     memoryPeak,
		CPUTimeNSec:    cpuTime,
		CGroup:         cgroup,
		FragmentPath:   fragmentPath,
	}

	return details, nil
}

func (s *SystemdService) ListUnits() (*types.SystemdServiceList, error) {
	ctx, cancel := context.WithTimeout(context.Background(), defaultUnitTimeout)
	defer cancel()

	conn, err := s.newConnection(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	units, err := conn.ListUnitsContext(ctx)
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

func getStringProperty(props map[string]interface{}, name string) string {
	if v, ok := props[name].(string); ok {
		return v
	}
	return ""
}

func getStringArrayProperty(props map[string]interface{}, name string) []string {
	if v, ok := props[name].([]string); ok {
		return v
	}
	return []string{}
}

func getUint32Property(props map[string]interface{}, name string) uint32 {
	if v, ok := props[name].(uint32); ok {
		return v
	}
	if v, ok := props[name].(uint64); ok {
		return uint32(v)
	}
	return 0
}

func getUint64Property(props map[string]interface{}, name string) uint64 {
	if v, ok := props[name].(uint64); ok {
		return v
	}
	return 0
}

type ServiceMetrics struct {
	// CPU usage in nanoseconds
	CPUUsage float64
	// Memory usage in bytes
	MemoryUsage uint64
}

func (s *SystemdService) getServiceMetrics(ctx context.Context, unitName string) (*ServiceMetrics, error) {
	conn, err := s.newConnection(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	props, err := conn.GetAllPropertiesContext(ctx, unitName)
	if err != nil {
		return nil, fmt.Errorf("failed to get service properties: %w", err)
	}

	cpuNs := getUint64Property(props, "CPUUsageNSec")

	memBytes := getUint64Property(props, "MemoryCurrent")

	return &ServiceMetrics{
		CPUUsage:    float64(cpuNs),
		MemoryUsage: memBytes,
	}, nil
}
