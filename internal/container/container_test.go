package container

import (
	"context"
	"strings"
	"testing"
	"time"
)

// TestWithRealContainer runs a comprehensive test with a real Docker container
func TestWithRealContainer(t *testing.T) {
	// Set up container service and test container
	s := setupContainerService(t)
	containerID := setupTestContainer(t)
	defer teardownTestContainer(t, containerID)

	// Test listing containers and finding our test container
	t.Run("ListContainers", func(t *testing.T) {
		list, err := s.ListContainers(context.Background())
		if err != nil {
			t.Fatalf("ListContainers failed: %v", err)
		}

		var found bool
		for _, container := range list.Containers {
			if strings.HasPrefix(containerID, container.ID) {
				found = true
				t.Logf("Found test container: %+v", container)
				break
			}
		}

		if !found {
			t.Fatalf("Test container %s not found in container list", containerID)
		}

		// Verify that at least some containers have expected states
		var hasRunning bool
		for _, container := range list.Containers {
			if container.IsRunning {
				hasRunning = true
				break
			}
		}

		if !hasRunning {
			t.Error("No running containers found")
		}
	})

	// Test getting details of our test container
	t.Run("GetContainerDetails", func(t *testing.T) {
		details, err := s.GetContainerDetails(context.Background(), containerID)
		if err != nil {
			t.Fatalf("GetContainerDetails failed: %v", err)
		}

		if !strings.HasPrefix(containerID, details.Container.ID) {
			t.Errorf("Container ID mismatch: got %s, want prefix of %s", details.Container.ID, containerID)
		}

		if details.Container.Image != testContainerImage {
			t.Errorf("Container image mismatch: got %s, want %s", details.Container.Image, testContainerImage)
		}

		if !details.Container.IsRunning {
			t.Error("Container should be running")
		}

		t.Logf("Container details: %+v", details)
	})

	// Test stopping the container
	t.Run("StopContainer", func(t *testing.T) {
		err := s.StopContainer(context.Background(), containerID)
		if err != nil {
			t.Fatalf("StopContainer failed: %v", err)
		}

		// Verify container is stopped
		time.Sleep(1 * time.Second)
		details, err := s.GetContainerDetails(context.Background(), containerID)
		if err != nil {
			t.Fatalf("GetContainerDetails after stop failed: %v", err)
		}

		if details.Container.IsRunning {
			t.Error("Container still running after stop")
		}
	})

	// Test starting the container
	t.Run("StartContainer", func(t *testing.T) {
		err := s.StartContainer(context.Background(), containerID)
		if err != nil {
			t.Fatalf("StartContainer failed: %v", err)
		}

		// Verify container is started
		time.Sleep(1 * time.Second)
		details, err := s.GetContainerDetails(context.Background(), containerID)
		if err != nil {
			t.Fatalf("GetContainerDetails after start failed: %v", err)
		}

		if !details.Container.IsRunning {
			t.Error("Container not running after start")
		}
	})

	// Test restarting the container
	t.Run("RestartContainer", func(t *testing.T) {
		// Get current container details
		details, err := s.GetContainerDetails(context.Background(), containerID)
		if err != nil {
			t.Fatalf("GetContainerDetails before restart failed: %v", err)
		}
		initialStatus := details.Container.Status

		// Restart the container
		err = s.RestartContainer(context.Background(), containerID)
		if err != nil {
			t.Fatalf("RestartContainer failed: %v", err)
		}

		// Verify container is restarted
		time.Sleep(2 * time.Second)
		details, err = s.GetContainerDetails(context.Background(), containerID)
		if err != nil {
			t.Fatalf("GetContainerDetails after restart failed: %v", err)
		}

		if !details.Container.IsRunning {
			t.Error("Container not running after restart")
		}

		// The status should be different after restart
		if details.Container.Status.State == initialStatus.State && details.Container.Status.Message == initialStatus.Message {
			t.Logf("Warning: Container status unchanged after restart: %s", details.Container.Status.Message)
		}
	})

	// Test with non-existent container
	t.Run("NonExistentContainer", func(t *testing.T) {
		nonExistentID := "nonexistent"

		// Try to get details
		_, err := s.GetContainerDetails(context.Background(), nonExistentID)
		if err == nil {
			t.Error("GetContainerDetails should fail for non-existent container")
		} else {
			t.Logf("GetContainerDetails correctly failed: %v", err)
		}

		// Try to start
		err = s.StartContainer(context.Background(), nonExistentID)
		if err == nil {
			t.Error("StartContainer should fail for non-existent container")
		} else {
			t.Logf("StartContainer correctly failed: %v", err)
		}

		// Try to stop
		err = s.StopContainer(context.Background(), nonExistentID)
		if err == nil {
			t.Error("StopContainer should fail for non-existent container")
		} else {
			t.Logf("StopContainer correctly failed: %v", err)
		}

		// Try to restart
		err = s.RestartContainer(context.Background(), nonExistentID)
		if err == nil {
			t.Error("RestartContainer should fail for non-existent container")
		} else {
			t.Logf("RestartContainer correctly failed: %v", err)
		}
	})

	// Test streaming logs
	t.Run("StreamContainerLogs", func(t *testing.T) {
		// Make sure the container is running and generating logs
		err := s.StartContainer(context.Background(), containerID)
		if err != nil {
			t.Fatalf("Failed to start container for log test: %v", err)
		}

		// Give it time to generate some logs
		time.Sleep(3 * time.Second)

		// Create a context with timeout
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// Stream logs without following
		logCh, errCh := s.StreamContainerLogs(ctx, containerID, false, 5)

		// Collect logs
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

		// We should have some logs from our test container
		t.Logf("Found %d log entries", len(logs))
		for i, log := range logs {
			if i < 3 { // Only log a few entries
				t.Logf("Log entry: %s", log)
			}
		}

		// Check if we got any logs containing our test message
		var foundTestLog bool
		for _, log := range logs {
			if strings.Contains(log, "Sirberus test container running") {
				foundTestLog = true
				break
			}
		}

		if !foundTestLog && len(logs) > 0 {
			t.Logf("Warning: Did not find expected log message in logs")
		}

		// Test with follow mode but with a short timeout
		ctx, cancel = context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()

		logCh, errCh = s.StreamContainerLogs(ctx, containerID, true, 1)

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
		}
	})

	// Test executing commands in container
	t.Run("ExecInContainer", func(t *testing.T) {
		// Make sure the container is running
		err := s.StartContainer(context.Background(), containerID)
		if err != nil {
			t.Fatalf("Failed to start container for exec test: %v", err)
		}

		// Create context
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		// Execute a simple command
		outputCh, errCh := s.ExecInContainer(ctx, containerID, "echo 'test message'")

		// Collect output
		var output []string
		var execErr error

	collectOutput:
		for {
			select {
			case line, ok := <-outputCh:
				if !ok {
					break collectOutput
				}
				output = append(output, line)
			case err, ok := <-errCh:
				if !ok {
					break collectOutput
				}
				if err != nil && err != context.DeadlineExceeded && err != context.Canceled {
					execErr = err
					break collectOutput
				}
			case <-ctx.Done():
				break collectOutput
			}
		}

		if execErr != nil {
			t.Errorf("Error executing command: %v", execErr)
		}

		// Verify output
		if len(output) == 0 {
			t.Error("No output received from command execution")
		} else {
			foundMessage := false
			for _, line := range output {
				if strings.Contains(line, "test message") {
					foundMessage = true
					break
				}
			}
			if !foundMessage {
				t.Errorf("Expected output not found. Got: %v", output)
			}
		}

		// Test with invalid command
		outputCh, errCh = s.ExecInContainer(ctx, containerID, "nonexistentcommand")

		// Should receive an error
		select {
		case err := <-errCh:
			if err == nil {
				t.Error("Expected error for invalid command, got nil")
			} else {
				t.Logf("Got expected error for invalid command: %v", err)
			}
		case <-ctx.Done():
			t.Error("Timeout waiting for error from invalid command")
		}
	})
}
