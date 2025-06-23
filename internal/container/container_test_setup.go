package container

import (
	"context"
	"io"
	"log/slog"
	"os"
	"testing"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/client"
)

const (
	// Test container name
	testContainerName = "sirberus-test"
	// Test container image
	testContainerImage = "alpine:latest"
	// Test container command
	testContainerCommand = "sh -c 'while true; do echo \"Sirberus test container running\"; sleep 1; done'"
)

// setupContainerService creates a new ContainerService for testing
func setupContainerService(t *testing.T) *ContainerService {
	t.Helper()

	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelDebug,
	}))

	service, err := NewContainerService(logger)
	if err != nil {
		t.Fatalf("Failed to create container service: %v", err)
	}

	return service
}

// setupTestContainer creates a test container
func setupTestContainer(t *testing.T) string {
	t.Helper()

	// Create Docker client
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		t.Fatalf("Failed to create Docker client: %v", err)
	}
	defer cli.Close()

	// Pull the test image
	reader, err := cli.ImagePull(context.Background(), testContainerImage, image.PullOptions{})
	if err != nil {
		t.Fatalf("Failed to pull test image: %v", err)
	}
	defer reader.Close()

	// Consume and discard the pull output
	_, err = io.Copy(io.Discard, reader)
	if err != nil {
		t.Fatalf("Failed to read pull output: %v", err)
	}

	// Create container
	resp, err := cli.ContainerCreate(context.Background(),
		&container.Config{
			Image: testContainerImage,
			Cmd:   []string{"sh", "-c", testContainerCommand},
			Tty:   true,
		},
		nil, nil, nil, testContainerName)
	if err != nil {
		t.Fatalf("Failed to create test container: %v", err)
	}

	// Start container
	err = cli.ContainerStart(context.Background(), resp.ID, container.StartOptions{})
	if err != nil {
		t.Fatalf("Failed to start test container: %v", err)
	}

	t.Logf("Test container %s created and started with ID %s", testContainerName, resp.ID)
	return resp.ID
}

// teardownTestContainer removes the test container
func teardownTestContainer(t *testing.T, containerID string) {
	t.Helper()

	// Create Docker client
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		t.Fatalf("Failed to create Docker client: %v", err)
	}
	defer cli.Close()

	// Stop container
	timeout := 10 // seconds
	err = cli.ContainerStop(context.Background(), containerID, container.StopOptions{Timeout: &timeout})
	if err != nil {
		t.Logf("Warning: Failed to stop test container: %v", err)
	}

	// Remove container
	err = cli.ContainerRemove(context.Background(), containerID, container.RemoveOptions{
		Force: true,
	})
	if err != nil {
		t.Logf("Warning: Failed to remove test container: %v", err)
	}

	t.Logf("Test container %s cleaned up", containerID)
}
