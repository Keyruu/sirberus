package systemd

import (
	"bufio"
	"context"
	"fmt"
	"log/slog"
	"os/exec"
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
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err := s.newConnection(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	// Get basic unit information
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
	props, err := conn.GetAllPropertiesContext(ctx, name)
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

func (s *SystemdService) StartUnit(name string) error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err := s.newConnection(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	ch := make(chan string)
	_, err = conn.StartUnitContext(ctx, name, "replace", ch)
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

	conn, err := s.newConnection(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	ch := make(chan string)
	_, err = conn.StopUnitContext(ctx, name, "replace", ch)
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

	conn, err := s.newConnection(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()

	ch := make(chan string)
	_, err = conn.RestartUnitContext(ctx, name, "replace", ch)
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
	conn, err := s.newConnection(ctx)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	cpuProp, err := conn.GetServicePropertyContext(ctx, unitName, "CPUUsageNSec")
	if err != nil {
		return nil, fmt.Errorf("failed to get CPU usage: %w", err)
	}

	memProp, err := conn.GetServicePropertyContext(ctx, unitName, "MemoryCurrent")
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

// StreamServiceLogs streams logs from a systemd service using journalctl command
// It returns a channel that will receive log entries and an error channel
func (s *SystemdService) StreamServiceLogs(ctx context.Context, unitName string, follow bool, numLines int) (<-chan string, <-chan error) {
	logCh := make(chan string)
	errCh := make(chan error, 1)

	go func() {
		defer close(logCh)
		defer close(errCh)

		// Build journalctl command
		args := []string{"-u", unitName}
		
		if follow {
			args = append(args, "-f")
		}
		
		if numLines > 0 {
			args = append(args, "-n", fmt.Sprintf("%d", numLines))
		}
		
		// Add output formatting
		args = append(args, "-o", "short-iso")
		
		s.logger.Debug("executing journalctl command", "args", args)
		
		// Create command with context
		cmd := exec.CommandContext(ctx, "journalctl", args...)
		
		// Get stdout pipe
		stdout, err := cmd.StdoutPipe()
		if err != nil {
			errCh <- fmt.Errorf("failed to get stdout pipe: %w", err)
			return
		}
		
		// Get stderr pipe for error reporting
		stderr, err := cmd.StderrPipe()
		if err != nil {
			errCh <- fmt.Errorf("failed to get stderr pipe: %w", err)
			return
		}
		
		// Start the command
		if err := cmd.Start(); err != nil {
			errCh <- fmt.Errorf("failed to start journalctl: %w", err)
			return
		}
		
		// Handle stderr in a separate goroutine
		go func() {
			scanner := bufio.NewScanner(stderr)
			var errMsg strings.Builder
			for scanner.Scan() {
				errMsg.WriteString(scanner.Text())
				errMsg.WriteString("\n")
			}
			if errMsg.Len() > 0 {
				s.logger.Warn("journalctl stderr output", "stderr", errMsg.String())
			}
		}()
		
		// Read stdout line by line
		scanner := bufio.NewScanner(stdout)
		for scanner.Scan() {
			line := scanner.Text()
			
			// Skip empty lines
			if strings.TrimSpace(line) == "" {
				continue
			}
			
			// Send the log entry
			select {
			case logCh <- line:
				s.logger.Debug("sent log line", "log", line)
			case <-ctx.Done():
				s.logger.Debug("context done while sending log")
				return
			}
		}
		
		// Check for scanner errors
		if err := scanner.Err(); err != nil {
			errCh <- fmt.Errorf("error reading journalctl output: %w", err)
			return
		}
		
		// Wait for command to finish
		if err := cmd.Wait(); err != nil {
			// Only report error if it's not due to context cancellation
			if ctx.Err() == nil {
				errCh <- fmt.Errorf("journalctl command failed: %w", err)
			}
			return
		}
		
		s.logger.Debug("journalctl command completed successfully")
	}()

	return logCh, errCh
}
