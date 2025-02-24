package types

type SystemdService struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	LoadState   string  `json:"loadState"`
	ActiveState string  `json:"activeState"`
	SubState    string  `json:"subState"`
	CPUUsage    float64 `json:"cpuUsage"`
	MemoryUsage uint64  `json:"memoryUsage"`
}

type SystemdServiceList struct {
	Services []SystemdService `json:"services"`
	Count    int              `json:"count"`
}
