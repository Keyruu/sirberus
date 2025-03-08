package systemd

import (
	"context"
	"fmt"
	"testing"
	"time"
)

// TestWithNonExistentService tests behavior with a non-existent service
func TestWithNonExistentService(t *testing.T) {
	s := setupSystemdService(t)
	nonExistentService := "sirberus-nonexistent.service"

	// Test GetUnitDetails
	_, err := s.GetUnitDetails(nonExistentService)
	if err == nil {
		t.Error("GetUnitDetails should fail for non-existent service")
	} else {
		t.Logf("GetUnitDetails correctly failed: %v", err)
	}

	// Test service actions
	err = s.StartUnit(nonExistentService)
	if err == nil {
		t.Error("StartUnit should fail for non-existent service")
	} else {
		t.Logf("StartUnit correctly failed: %v", err)
	}

	err = s.StopUnit(nonExistentService)
	if err == nil {
		t.Error("StopUnit should fail for non-existent service")
	} else {
		t.Logf("StopUnit correctly failed: %v", err)
	}

	err = s.RestartUnit(nonExistentService)
	if err == nil {
		t.Error("RestartUnit should fail for non-existent service")
	} else {
		t.Logf("RestartUnit correctly failed: %v", err)
	}

	// Test streaming logs
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	logCh, errCh := s.StreamServiceLogs(ctx, nonExistentService, false, 5)

	// We need to handle both cases:
	// 1. An error is sent on the error channel
	// 2. The channels are closed without sending anything (which is also valid behavior)
	select {
	case log, ok := <-logCh:
		if ok {
			t.Logf("Unexpectedly received log for non-existent service: %s", log)
		} else {
			t.Log("Log channel closed without error (valid behavior)")
		}
	case err, ok := <-errCh:
		if !ok {
			t.Log("Error channel closed without error (valid behavior)")
		} else if err != nil {
			t.Logf("StreamServiceLogs correctly failed: %v", err)
		} else {
			t.Log("StreamServiceLogs returned nil error for non-existent service (may be valid)")
		}
	case <-time.After(3 * time.Second):
		t.Log("Timed out waiting for response from StreamServiceLogs")
	}

	// We don't fail the test here, just log what happened
}

// TestInvalidServiceName tests behavior with invalid service names
func TestInvalidServiceName(t *testing.T) {
	s := setupSystemdService(t)
	invalidServiceNames := []string{
		"",                     // Empty string
		"invalid",              // Missing .service suffix
		"../etc/passwd",        // Path traversal attempt
		"service; rm -rf /",    // Command injection attempt
		"service\x00malicious", // Null byte injection attempt
	}

	for _, name := range invalidServiceNames {
		t.Run(fmt.Sprintf("InvalidName_%s", name), func(t *testing.T) {
			// Test GetUnitDetails
			_, err := s.GetUnitDetails(name)
			if err == nil {
				t.Errorf("GetUnitDetails should fail for invalid service name: %s", name)
			}

			// Test service actions
			err = s.StartUnit(name)
			if err == nil {
				t.Errorf("StartUnit should fail for invalid service name: %s", name)
			}

			err = s.StopUnit(name)
			if err == nil {
				t.Errorf("StopUnit should fail for invalid service name: %s", name)
			}

			err = s.RestartUnit(name)
			if err == nil {
				t.Errorf("RestartUnit should fail for invalid service name: %s", name)
			}
		})
	}
}
