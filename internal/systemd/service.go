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

	// Get InvocationID - it's stored as []uint8 in systemd
	invocationID := ""
	if invocationValue, exists := props["InvocationID"]; exists {
		s.logger.Debug("InvocationID property found",
			"service", name,
			"type", fmt.Sprintf("%T", invocationValue))

		// Handle the []uint8 type specifically
		if bytes, ok := invocationValue.([]uint8); ok {
			invocationID = formatUUID(bytes)
			s.logger.Debug("Converted InvocationID",
				"service", name,
				"invocationID", invocationID)
		} else {
			// Unexpected type - log it for debugging
			s.logger.Debug("InvocationID has unexpected type",
				"service", name,
				"type", fmt.Sprintf("%T", invocationValue),
				"value", fmt.Sprintf("%v", invocationValue))
		}
	} else {
		s.logger.Debug("InvocationID property not found in map",
			"service", name,
			"active_state", unit.ActiveState,
			"sub_state", unit.SubState)
	}
	dropInPaths := getStringArrayProperty(props, "DropInPaths")
	triggeredBy := getStringArrayProperty(props, "TriggeredBy")
	docs := getStringArrayProperty(props, "Documentation")

	mainProcess := ""
	if mainPID > 0 {
		// Try to get the actual command line from /proc/{pid}/cmdline
		if cmdline, err := readProcCmdline(mainPID); err == nil && cmdline != "" {
			mainProcess = cmdline
		} else {
			// Fall back to ExecStart if we can't read from /proc
			mainProcess = getStringProperty(props, "ExecStart")
			s.logger.Debug("couldn't read process command line from /proc, using ExecStart instead",
				"pid", mainPID,
				"error", err)
		}
	}

	since := ""
	var uptimeSeconds int64 = 0
	if timestamp := getUint64Property(props, "ActiveEnterTimestamp"); timestamp > 0 {
		seconds := int64(timestamp / uint64(microsecondsPerSecond))
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
					seconds := int64(timestamp / uint64(microsecondsPerSecond))
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

// getPropertyNames returns a list of all property names in the map
// This is useful for debugging when a property is not found
func getPropertyNames(props map[string]interface{}) []string {
	names := make([]string, 0, len(props))
	for name := range props {
		names = append(names, name)
	}
	return names
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

	// Get the service start time to detect restarts
	var startTime time.Time
	if timestamp := getUint64Property(props, "ActiveEnterTimestamp"); timestamp > 0 {
		seconds := int64(timestamp / uint64(microsecondsPerSecond))
		startTime = time.Unix(seconds, 0)
	} else {
		startTime = time.Now() // Fallback if timestamp not available
	}

	// Get CPU usage from cgroup, passing the service start time
	cpuPercentage, isFirstMeasurement, err := s.getCGroupCPUPercentage(cgroup, startTime)
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

	// If this is the first measurement, don't return 0 as it's misleading
	// Instead, return null/undefined in the API by using -1 as a sentinel value
	// The frontend will handle this special value
	if isFirstMeasurement {
		s.logger.Debug("First CPU measurement or service restarted, returning null value",
			"service", unitName,
			"cgroup", cgroup,
			"startTime", startTime)
		return &ServiceMetrics{
			CPUUsage:    -1, // Special value to indicate no measurement yet
			MemoryUsage: memBytes,
		}, nil
	}

	s.logger.Debug("CPU usage from cgroup",
		"service", unitName,
		"cgroup", cgroup,
		"percentage", cpuPercentage,
		"startTime", startTime)

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
// Returns: CPU percentage, isFirstMeasurement flag, error
func (s *SystemdService) getCGroupCPUPercentage(cgroupPath string, serviceStartTime time.Time) (float64, bool, error) {
	// Get current CPU usage
	currentUsage, isV2, err := s.readCGroupCPUUsage(cgroupPath)
	if err != nil {
		return 0, false, err
	}

	now := time.Now()
	serviceKey := cgroupPath // Use cgroup path as the key

	// Check if we have a previous measurement
	if prev, ok := prevCPUMeasurements[serviceKey]; ok {
		// Check if the service was restarted after our last measurement
		// If the service start time is newer than our last measurement, treat as first measurement
		if serviceStartTime.After(prev.timestamp) {
			s.logger.Debug("Service was restarted after last measurement, treating as first measurement",
				"service", cgroupPath,
				"serviceStartTime", serviceStartTime,
				"lastMeasurementTime", prev.timestamp)

			// Update the measurement with current values
			prevCPUMeasurements[serviceKey] = struct {
				cpuUsage  uint64
				timestamp time.Time
			}{
				cpuUsage:  currentUsage,
				timestamp: now,
			}

			return 0, true, nil
		}

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

			return cpuPercentage, false, nil
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

	return 0, true, nil
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

// formatUUID formats a byte array as a UUID string in the format "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
func formatUUID(bytes []byte) string {
	if len(bytes) != 16 {
		return fmt.Sprintf("%x", bytes) // Not a standard UUID, just return hex
	}

	return fmt.Sprintf("%x-%x-%x-%x-%x",
		bytes[0:4],   // 8 chars
		bytes[4:6],   // 4 chars
		bytes[6:8],   // 4 chars
		bytes[8:10],  // 4 chars
		bytes[10:16], // 12 chars
	)
}

// readProcCmdline reads the command line of a process from /proc/{pid}/cmdline
func readProcCmdline(pid uint32) (string, error) {
	cmdlinePath := fmt.Sprintf("/proc/%d/cmdline", pid)

	// Check if the file exists
	if _, err := os.Stat(cmdlinePath); err != nil {
		return "", fmt.Errorf("cmdline file not found: %w", err)
	}

	// Read the file
	data, err := os.ReadFile(cmdlinePath)
	if err != nil {
		return "", fmt.Errorf("failed to read cmdline: %w", err)
	}

	// Process cmdline - replace null bytes with spaces
	// In /proc/{pid}/cmdline, arguments are separated by null bytes
	for i, b := range data {
		if b == 0 {
			data[i] = ' '
		}
	}

	cmdline := strings.TrimSpace(string(data))
	if cmdline == "" {
		return "", fmt.Errorf("empty cmdline")
	}

	return cmdline, nil
}
