package systemd

import (
	"bufio"
	"context"
	"fmt"
	"log/slog"
	"os"
	"runtime"
	"strconv"
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
	var uptimeSeconds int64 = 0
	if timestamp := getUint64Property(props, "ActiveEnterTimestamp"); timestamp > 0 {
		seconds := int64(timestamp / microsecondsPerSecond)
		sinceTime := time.Unix(seconds, 0)
		since = sinceTime.Format(time.RFC3339)

		// Calculate uptime in seconds only if the service is running
		if unit.SubState == "running" {
			uptimeSeconds = int64(time.Since(sinceTime).Seconds())
		}
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
			Uptime:      uptimeSeconds,
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

		var uptimeSeconds int64 = 0

		if unit.SubState == "running" {
			// Get metrics
			if m, err := s.getServiceMetrics(ctx, unit.Name); err != nil {
				s.logger.Error("failed to get service metrics",
					"service", unit.Name,
					"error", err)
			} else {
				metrics = m
			}

			// Get uptime for running services
			props, err := conn.GetAllPropertiesContext(ctx, unit.Name)
			if err == nil {
				if timestamp := getUint64Property(props, "ActiveEnterTimestamp"); timestamp > 0 {
					seconds := int64(timestamp / microsecondsPerSecond)
					sinceTime := time.Unix(seconds, 0)
					uptimeSeconds = int64(time.Since(sinceTime).Seconds())
				}
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
			Uptime:      uptimeSeconds,
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
	// CPU usage as percentage of a single core (can exceed 100% if using multiple cores)
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

	// Get memory usage
	memBytes := getUint64Property(props, "MemoryCurrent")

	// Get the cgroup path
	cgroup := getStringProperty(props, "ControlGroup")
	if cgroup == "" {
		return &ServiceMetrics{
			CPUUsage:    0,
			MemoryUsage: memBytes,
		}, nil
	}

	// Get CPU usage from cgroup
	cpuPercentage, err := s.getCGroupCPUPercentage(cgroup)
	if err != nil {
		s.logger.Error("failed to get CPU percentage from cgroup",
			"service", unitName,
			"cgroup", cgroup,
			"error", err)
		return &ServiceMetrics{
			CPUUsage:    0,
			MemoryUsage: memBytes,
		}, nil
	}

	s.logger.Debug("CPU usage from cgroup",
		"service", unitName,
		"cgroup", cgroup,
		"percentage", cpuPercentage)

	return &ServiceMetrics{
		CPUUsage:    cpuPercentage,
		MemoryUsage: memBytes,
	}, nil
}

// Store previous CPU measurements to calculate short-term usage
var (
	prevCPUMeasurements = make(map[string]struct {
		cpuUsage  uint64
		timestamp time.Time
	})
)

// getCGroupCPUPercentage gets CPU usage percentage from cgroup
func (s *SystemdService) getCGroupCPUPercentage(cgroupPath string) (float64, error) {
	// Get current CPU usage
	currentUsage, isV2, err := s.readCGroupCPUUsage(cgroupPath)
	if err != nil {
		return 0, err
	}

	now := time.Now()
	serviceKey := cgroupPath // Use cgroup path as the key

	// Check if we have a previous measurement
	if prev, ok := prevCPUMeasurements[serviceKey]; ok {
		// Calculate time difference in seconds
		timeDiffSec := now.Sub(prev.timestamp).Seconds()

		// Only calculate if we have a meaningful time difference
		if timeDiffSec > 0.1 { // At least 100ms
			// Calculate CPU usage difference
			cpuDiff := currentUsage - prev.cpuUsage

			// Calculate percentage: (CPU time diff / elapsed time) * 100
			var cpuPercentage float64
			if isV2 {
				// For cgroup v2 (usage_usec), convert microseconds to seconds
				cpuPercentage = (float64(cpuDiff) / 1000000.0) / timeDiffSec * 100.0
			} else {
				// For cgroup v1 (usage_ns), convert nanoseconds to seconds
				cpuPercentage = (float64(cpuDiff) / 1000000000.0) / timeDiffSec * 100.0
			}

			// Update the previous measurement
			prevCPUMeasurements[serviceKey] = struct {
				cpuUsage  uint64
				timestamp time.Time
			}{
				cpuUsage:  currentUsage,
				timestamp: now,
			}

			s.logger.Debug("CPU usage calculation",
				"service", cgroupPath,
				"cpuDiff", cpuDiff,
				"timeDiffSec", timeDiffSec,
				"percentage", cpuPercentage,
				"isV2", isV2)

			return cpuPercentage, nil
		}
	}

	// First measurement or too short interval, store and return 0
	prevCPUMeasurements[serviceKey] = struct {
		cpuUsage  uint64
		timestamp time.Time
	}{
		cpuUsage:  currentUsage,
		timestamp: now,
	}

	return 0, nil
}

// readCGroupCPUUsage reads CPU usage from cgroup (either v1 or v2)
// Returns: usage value, isV2 flag, error
func (s *SystemdService) readCGroupCPUUsage(cgroupPath string) (uint64, bool, error) {
	// Try cgroup v2 first
	usage, err := s.readCGroupV2CPUUsage(cgroupPath)
	if err == nil {
		return usage, true, nil
	}

	// Fall back to cgroup v1
	usage, err = s.readCGroupV1CPUUsage(cgroupPath)
	if err == nil {
		return usage, false, nil
	}

	return 0, false, fmt.Errorf("failed to read CPU usage from cgroup: %w", err)
}

// readCGroupV2CPUUsage reads CPU usage from cgroup v2
func (s *SystemdService) readCGroupV2CPUUsage(cgroupPath string) (uint64, error) {
	// In cgroup v2, CPU usage is in /sys/fs/cgroup/<path>/cpu.stat
	statPath := fmt.Sprintf("/sys/fs/cgroup%s/cpu.stat", cgroupPath)

	// Check if the file exists
	if _, err := os.Stat(statPath); err != nil {
		return 0, fmt.Errorf("cpu.stat not found: %w", err)
	}

	// Read the file
	file, err := os.Open(statPath)
	if err != nil {
		return 0, fmt.Errorf("failed to open %s: %w", statPath, err)
	}
	defer file.Close()

	// Parse the file to get usage_usec
	var usageUsec uint64
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "usage_usec") {
			parts := strings.Fields(line)
			if len(parts) >= 2 {
				usageUsec, err = strconv.ParseUint(parts[1], 10, 64)
				if err != nil {
					return 0, fmt.Errorf("failed to parse usage_usec: %w", err)
				}
				break
			}
		}
	}

	if usageUsec == 0 {
		return 0, fmt.Errorf("usage_usec not found in %s", statPath)
	}

	return usageUsec, nil
}

// readCGroupV1CPUUsage reads CPU usage from cgroup v1
func (s *SystemdService) readCGroupV1CPUUsage(cgroupPath string) (uint64, error) {
	// In cgroup v1, CPU usage is in /sys/fs/cgroup/cpu,cpuacct/<path>/cpuacct.usage
	// or /sys/fs/cgroup/cpuacct/<path>/cpuacct.usage
	paths := []string{
		fmt.Sprintf("/sys/fs/cgroup/cpu,cpuacct%s/cpuacct.usage", cgroupPath),
		fmt.Sprintf("/sys/fs/cgroup/cpuacct%s/cpuacct.usage", cgroupPath),
	}

	var usageNs uint64
	var err error
	var foundPath string

	for _, path := range paths {
		if _, err = os.Stat(path); err == nil {
			data, err := os.ReadFile(path)
			if err != nil {
				continue
			}

			usageStr := strings.TrimSpace(string(data))
			usageNs, err = strconv.ParseUint(usageStr, 10, 64)
			if err != nil {
				continue
			}

			foundPath = path
			break
		}
	}

	if foundPath == "" {
		return 0, fmt.Errorf("could not find cpuacct.usage for cgroup %s", cgroupPath)
	}

	return usageNs, nil
}
