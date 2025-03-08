package systemd

import (
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
)

const (
	// Test service name
	testServiceName = "sirberus-test.service"
	// Test service content template
	testServiceTemplate = `[Unit]
Description=Sirberus Test Service
After=network.target

[Service]
Type=simple
ExecStart=/bin/sh -c 'while true; do echo "Sirberus test service running"; sleep 1; done'
Restart=on-failure

[Install]
WantedBy=multi-user.target
`
)

// TestMain sets up the test environment and skips tests if not on Linux
func TestMain(m *testing.M) {
	if runtime.GOOS != "linux" {
		println("Skipping systemd tests: systemd is only supported on Linux")
		os.Exit(0)
	}

	// Check if running as root or with sufficient permissions
	if os.Geteuid() != 0 {
		println("Warning: Some systemd tests may fail without root privileges")
	}

	os.Exit(m.Run())
}

// setupSystemdService creates a new SystemdService for testing
func setupSystemdService(t *testing.T) *SystemdService {
	t.Helper()

	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))

	service, err := NewSystemdService(logger)
	if err != nil {
		t.Fatalf("Failed to create SystemdService: %v", err)
	}

	return service
}

// setupTestService creates a temporary systemd service for testing
func setupTestService(t *testing.T) {
	t.Helper()

	// Create service file
	serviceFilePath := filepath.Join("/etc/systemd/system", testServiceName)
	err := os.WriteFile(serviceFilePath, []byte(testServiceTemplate), 0644)
	if err != nil {
		t.Fatalf("Failed to create test service file: %v", err)
	}

	// Reload systemd to recognize the new service
	cmd := exec.Command("systemctl", "daemon-reload")
	if err := cmd.Run(); err != nil {
		t.Fatalf("Failed to reload systemd: %v", err)
	}

	// Start the service
	cmd = exec.Command("systemctl", "start", testServiceName)
	if err := cmd.Run(); err != nil {
		// Clean up the service file if we can't start it
		os.Remove(serviceFilePath)
		t.Fatalf("Failed to start test service: %v", err)
	}

	t.Logf("Test service %s created and started", testServiceName)
}

// teardownTestService removes the temporary systemd service
func teardownTestService(t *testing.T) {
	t.Helper()

	// Stop the service
	cmd := exec.Command("systemctl", "stop", testServiceName)
	if err := cmd.Run(); err != nil {
		t.Logf("Warning: Failed to stop test service: %v", err)
	}

	// Remove the service file
	serviceFilePath := filepath.Join("/etc/systemd/system", testServiceName)
	if err := os.Remove(serviceFilePath); err != nil {
		t.Logf("Warning: Failed to remove test service file: %v", err)
	}

	// Reload systemd
	cmd = exec.Command("systemctl", "daemon-reload")
	if err := cmd.Run(); err != nil {
		t.Logf("Warning: Failed to reload systemd after cleanup: %v", err)
	}

	t.Logf("Test service %s cleaned up", testServiceName)
}
