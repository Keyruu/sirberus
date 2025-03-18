package systemd

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"
)

// TestLogStreaming tests the log streaming functionality in more detail
func TestLogStreaming(t *testing.T) {
	// Skip if not on Linux
	if os.Geteuid() != 0 {
		t.Skip("Skipping log streaming tests: requires root privileges")
	}

	s := setupSystemdService(t)

	// Find a service that's likely to have logs
	servicesToTry := []string{
		"systemd-journald.service",
		"systemd-logind.service",
		"sshd.service",
		"dbus.service",
	}

	var serviceWithLogs string
	for _, svc := range servicesToTry {
		// Check if service exists and is active
		details, err := s.GetUnitDetails(svc)
		if err == nil && details.Service.ActiveState == "active" {
			// Try to get some logs
			ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
			logCh, errCh := s.StreamServiceLogs(ctx, svc, false, 5)

			var logs []string
			var streamErr error

		collectLogs:
			for {
				select {
				case log, ok := <-logCh:
					if !ok {
						break collectLogs
					}
					logs = append(logs, log)
				case err, ok := <-errCh:
					if !ok {
						break collectLogs
					}
					if err != nil && err != context.DeadlineExceeded && err != context.Canceled {
						streamErr = err
						break collectLogs
					}
				case <-ctx.Done():
					break collectLogs
				}
			}

			cancel()

			if streamErr == nil && len(logs) > 0 {
				serviceWithLogs = svc
				t.Logf("Found service with logs: %s (%d log entries)", svc, len(logs))
				break
			}
		}
	}

	if serviceWithLogs == "" {
		t.Skip("Could not find a service with logs for testing")
	}

	// Test different log retrieval scenarios
	t.Run("RetrieveDifferentLogCounts", func(t *testing.T) {
		logCounts := []int{1, 5, 10, 20}

		for _, count := range logCounts {
			t.Run(fmt.Sprintf("LogCount_%d", count), func(t *testing.T) {
				ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
				defer cancel()

				logCh, errCh := s.StreamServiceLogs(ctx, serviceWithLogs, false, count)

				var logs []string
				var streamErr error

			collectLogs:
				for {
					select {
					case log, ok := <-logCh:
						if !ok {
							break collectLogs
						}
						logs = append(logs, log)
					case err, ok := <-errCh:
						if !ok {
							break collectLogs
						}
						if err != nil && err != context.DeadlineExceeded && err != context.Canceled {
							streamErr = err
							break collectLogs
						}
					case <-ctx.Done():
						break collectLogs
					}
				}

				if streamErr != nil {
					t.Errorf("Error streaming logs with count %d: %v", count, streamErr)
				}

				// We may not always get exactly the requested number of logs
				// due to journal limitations, but we should get some logs
				t.Logf("Requested %d logs, got %d logs", count, len(logs))

				// Log a few entries for debugging
				for i, log := range logs {
					if i < 3 {
						t.Logf("Log entry %d: %s", i, log)
					}
				}
			})
		}
	})

	// Test log format
	t.Run("LogFormat", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()

		logCh, errCh := s.StreamServiceLogs(ctx, serviceWithLogs, false, 5)

		var logs []string
		var streamErr error

	collectLogs:
		for {
			select {
			case log, ok := <-logCh:
				if !ok {
					break collectLogs
				}
				logs = append(logs, log)
			case err, ok := <-errCh:
				if !ok {
					break collectLogs
				}
				if err != nil && err != context.DeadlineExceeded && err != context.Canceled {
					streamErr = err
					break collectLogs
				}
			case <-ctx.Done():
				break collectLogs
			}
		}

		if streamErr != nil {
			t.Errorf("Error streaming logs: %v", streamErr)
		}

		if len(logs) == 0 {
			t.Skip("No logs found to test format")
		}

		// Check log format (should be timestamp followed by message)
		for i, log := range logs {
			if i >= 3 {
				break // Only check a few logs
			}

			// Log entries should have a timestamp followed by a message
			// The format is: "timestamp: message"
			parts := strings.SplitN(log, ": ", 2)
			if len(parts) != 2 {
				t.Errorf("Log entry doesn't have expected format: %s", log)
				continue
			}

			timestamp, message := parts[0], parts[1]
			if timestamp == "" {
				t.Errorf("Log timestamp is empty: %s", log)
			}

			if message == "" {
				t.Errorf("Log message is empty: %s", log)
			}
		}
	})

	// Test follow mode with a short timeout
	t.Run("FollowMode", func(t *testing.T) {
		// Short timeout to avoid waiting too long
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		logCh, errCh := s.StreamServiceLogs(ctx, serviceWithLogs, true, 1)

		// Just verify we can read from the channel
		select {
		case log, ok := <-logCh:
			if ok {
				t.Logf("Got log in follow mode: %s", log)
			}
		case err := <-errCh:
			if err != nil && err != context.DeadlineExceeded && err != context.Canceled {
				t.Errorf("Error in follow mode: %v", err)
			}
		case <-ctx.Done():
			// Expected timeout
			t.Log("Context timeout in follow mode (expected)")
		}
	})

	// Test with context cancellation
	t.Run("ContextCancellation", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())

		logCh, errCh := s.StreamServiceLogs(ctx, serviceWithLogs, true, 1)

		// Cancel the context immediately
		cancel()

		// We should get a context canceled error or the channels should close
		select {
		case _, ok := <-logCh:
			if !ok {
				t.Log("Log channel closed after context cancellation (expected)")
			}
		case err, ok := <-errCh:
			if !ok {
				t.Log("Error channel closed after context cancellation (expected)")
			} else if err == context.Canceled {
				t.Log("Got context canceled error (expected)")
			} else if err != nil {
				t.Errorf("Unexpected error after context cancellation: %v", err)
			}
		case <-time.After(2 * time.Second):
			t.Error("Timed out waiting for response after context cancellation")
		}
	})
}

func TestLogEntryString(t *testing.T) {
	testCases := []struct {
		name     string
		entry    LogEntry
		expected string
	}{
		{
			name: "Normal entry",
			entry: LogEntry{
				Timestamp: "2023-01-02T15:04:05Z",
				Message:   "Test message",
				UnitName:  "test.service",
			},
			expected: "2023-01-02T15:04:05Z: Test message",
		},
		{
			name: "Empty message",
			entry: LogEntry{
				Timestamp: "2023-01-02T15:04:05Z",
				Message:   "",
				UnitName:  "test.service",
			},
			expected: "2023-01-02T15:04:05Z: ",
		},
		{
			name: "With timezone",
			entry: LogEntry{
				Timestamp: "2023-01-02T15:04:05+01:00",
				Message:   "Test message",
				UnitName:  "test.service",
			},
			expected: "2023-01-02T15:04:05+01:00: Test message",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := tc.entry.String()
			if result != tc.expected {
				t.Errorf("LogEntry.String() = %q, want %q", result, tc.expected)
			}
		})
	}
}
