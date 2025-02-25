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
	"github.com/coreos/go-systemd/v22/sdjournal"
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

// StreamServiceLogs streams logs from a systemd service using the journal API
// It returns a channel that will receive log entries and an error channel
func (s *SystemdService) StreamServiceLogs(ctx context.Context, unitName string, follow bool, numLines int) (<-chan string, <-chan error) {
	logCh := make(chan string)
	errCh := make(chan error, 1)

	go func() {
		defer close(logCh)
		defer close(errCh)

		// Open a new journal
		journal, err := sdjournal.NewJournal()
		if err != nil {
			errCh <- fmt.Errorf("failed to open journal: %w", err)
			return
		}
		defer journal.Close()

		// Add filter for the specific unit
		if err := journal.AddMatch("_SYSTEMD_UNIT=" + unitName); err != nil {
			errCh <- fmt.Errorf("failed to add unit match: %w", err)
			return
		}

		// Set up the journal position based on follow mode and numLines
		if numLines > 0 {
			// Seek to the end and then go back numLines entries
			if err := journal.SeekTail(); err != nil {
				errCh <- fmt.Errorf("failed to seek to tail: %w", err)
				return
			}
			
			// Get current cursor position for debugging
			cursor, _ := journal.GetCursor()
			s.logger.Debug("journal tail position", "cursor", cursor)
			
			// Move back numLines entries
			skipped := 0
			for i := 0; i < numLines; i++ {
				n, err := journal.Previous()
				if err != nil {
					errCh <- fmt.Errorf("failed to move to previous entry: %w", err)
					return
				}
				if n == 0 {
					s.logger.Debug("reached beginning of journal", "skipped", skipped)
					break // Reached the beginning of the journal
				}
				skipped++
			}
			s.logger.Debug("moved back in journal", "entries", skipped)
		} else {
			// If numLines is 0, start from the beginning
			if err := journal.SeekHead(); err != nil {
				errCh <- fmt.Errorf("failed to seek to head: %w", err)
				return
			}
		}
		
		// Log the starting position for debugging
		s.logger.Debug("journal position set", 
			"follow", follow, 
			"numLines", numLines)

		// Process journal entries
		for {
			select {
			case <-ctx.Done():
				errCh <- ctx.Err()
				return
			default:
				// Read the next entry
				n, err := journal.Next()
				if err != nil {
					errCh <- fmt.Errorf("error reading journal: %w", err)
					return
				}

				// If we've reached the end of the journal
				if n == 0 {
					if !follow {
						s.logger.Debug("reached end of journal and not following, exiting")
						return // We're done if not following
					}
					
					s.logger.Debug("reached end of journal, waiting for new entries")
					// Wait for new entries if following
					waitResult := journal.Wait(1 * time.Second)
					s.logger.Debug("journal wait returned", "result", waitResult)
					
					// Continue the loop regardless of wait result
					// This ensures we don't get stuck if the wait behavior is inconsistent
					continue
				}

				// Get the log message
				message, err := journal.GetDataValue("MESSAGE")
				if err != nil {
					s.logger.Warn("failed to get message from journal entry", "error", err)
					// Try to get the raw entry for debugging
					entry, _ := journal.GetEntry()
					if entry != nil {
						s.logger.Debug("raw journal entry", "fields", len(entry.Fields))
					}
					continue
				}

				// Get timestamp
				var timestamp time.Time
				if realtime, err := journal.GetRealtimeUsec(); err == nil {
					timestamp = time.Unix(int64(realtime/1000000), int64((realtime%1000000)*1000))
				} else {
					timestamp = time.Now()
				}
				
				// Get priority if available
				priority := ""
				if prio, err := journal.GetDataValue("PRIORITY"); err == nil {
					switch prio {
					case "0", "1", "2":
						priority = "EMERGENCY"
					case "3":
						priority = "ERROR"
					case "4":
						priority = "WARNING"
					case "5":
						priority = "NOTICE"
					case "6":
						priority = "INFO"
					case "7":
						priority = "DEBUG"
					}
				}
				
				// Format the log entry with timestamp, priority and message
				var formattedLog string
				if priority != "" {
					formattedLog = fmt.Sprintf("[%s] [%s] %s", timestamp.Format(time.RFC3339), priority, message)
				} else {
					formattedLog = fmt.Sprintf("[%s] %s", timestamp.Format(time.RFC3339), message)
				}
				
				// Get cursor for debugging
				cursor, _ := journal.GetCursor()
				s.logger.Debug("sending log entry", 
					"log", formattedLog, 
					"cursor", cursor)

				// Send the log entry
				select {
				case logCh <- formattedLog:
				case <-ctx.Done():
					errCh <- ctx.Err()
					return
				}
			}
		}
	}()

	return logCh, errCh
}
