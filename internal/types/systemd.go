package types

type SystemdService struct {
	// Service name
	Name string `json:"name"`
	// Service description
	Description string `json:"description"`
	// Load state (e.g., "loaded", "not-found")
	LoadState string `json:"loadState"`
	// Active state (e.g., "active", "inactive")
	ActiveState string `json:"activeState"`
	// Sub state (e.g., "running", "dead")
	SubState string `json:"subState"`
	// CPU usage in nanoseconds
	CPUUsage float64 `json:"cpuUsage"`
	// Memory usage in bytes
	MemoryUsage uint64 `json:"memoryUsage"`
} // @name SystemdService

type SystemdServiceDetails struct {
	Service SystemdService `json:"service"`
	// Drop-in configuration paths
	DropIn []string `json:"dropIn"`
	// Timestamp when the service was activated (RFC3339 format)
	Since string `json:"since"`
	// Invocation ID
	Invocation string `json:"invocation"`
	// Units that triggered this service
	TriggeredBy []string `json:"triggeredBy"`
	// Documentation URLs
	Docs []string `json:"docs"`
	// Main process ID
	MainPID uint32 `json:"mainPID"`
	// Main process command
	MainProcess string `json:"mainProcess"`
	// Bytes received over IP
	IPIngressBytes uint64 `json:"ipIngressBytes"`
	// Bytes sent over IP
	IPEgressBytes uint64 `json:"ipEgressBytes"`
	// Bytes read from disk
	IOReadBytes uint64 `json:"ioReadBytes"`
	// Bytes written to disk
	IOWriteBytes uint64 `json:"ioWriteBytes"`
	// Current number of tasks
	Tasks uint32 `json:"tasks"`
	// Maximum number of tasks allowed
	TasksLimit uint32 `json:"tasksLimit"`
	// Peak memory usage in bytes
	MemoryPeak uint64 `json:"memoryPeak"`
	// CPU time in nanoseconds
	CPUTimeNSec uint64 `json:"cpuTimeNSec"`
	// Control group path
	CGroup string `json:"cGroup"`
	// Path to the unit file
	FragmentPath string `json:"fragmentPath"`
	// List of processes
	Processes []string `json:"processes"`
} // @name SystemdServiceDetails

type SystemdServiceList struct {
	Services []SystemdService `json:"services"`
	Count    int              `json:"count"`
} // @name SystemdServiceList
