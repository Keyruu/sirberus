package types

import (
	"time"
)

// Mount represents a container mount point
type Mount struct {
	// Source path on host
	Source string `json:"source"`
	// Destination path in container
	Destination string `json:"destination"`
	// Mount mode (ro, rw)
	Mode string `json:"mode"`
} // @name Mount

// NetworkConfig represents container network configuration
type NetworkConfig struct {
	// Network IP address
	IPAddress string `json:"ipAddress"`
	// Network gateway
	Gateway string `json:"gateway"`
	// Network MAC address
	MacAddress string `json:"macAddress"`
} // @name NetworkConfig

// Container represents a container instance
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
	// Container mount points
	Mounts []Mount `json:"mounts"`
	// Container network configurations
	Networks map[string]NetworkConfig `json:"networks"`
	// Container labels
	Labels map[string]string `json:"labels"`
	// Container environment variables
	Environment []string `json:"environment"`
} // @name Container

// ContainerExecRequest represents a request to execute a command in a container
type ContainerExecRequest struct {
	// Command to execute
	Command string `json:"command"`
} // @name ContainerExecRequest

type ContainerList struct {
	// List of containers
	Containers []Container `json:"containers"`
	// Total count of containers
	Count int `json:"count"`
} // @name ContainerList
