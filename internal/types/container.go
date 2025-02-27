package types

import (
	"time"
)

type Container struct {
	// Short container ID
	ID string `json:"id"`
	// Container name
	Name string `json:"name"`
	// Container image
	Image string `json:"image"`
	// Command running in the container
	Command string `json:"command"`
	// Creation time
	Created time.Time `json:"created"`
	// Container status
	Status string `json:"status"`
	// Exposed ports
	Ports string `json:"ports"`
	// Container size
	Size string `json:"size,omitempty"`
	// Whether the container is currently running
	IsRunning bool `json:"isRunning"`
	// CPU usage in nanoseconds
	CPUUsage float64 `json:"cpuUsage"`
	// Memory usage in bytes
	MemoryUsage uint64 `json:"memoryUsage"`
}

type ContainerList struct {
	// List of containers
	Containers []Container `json:"containers"`
	// Total count of containers
	Count int `json:"count"`
}
