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

type SystemdServiceDetails struct {
	Service     SystemdService `json:"service"`
	Unit        string         `json:"unit"`
	Loaded      string         `json:"loaded"`
	DropIn      []string       `json:"dropIn"`
	Since       string         `json:"since"`
	Invocation  string         `json:"invocation"`
	TriggeredBy []string       `json:"triggeredBy"`
	Docs        []string       `json:"docs"`
	MainPID     uint32         `json:"mainPID"`
	MainProcess string         `json:"mainProcess"`
	IP          string         `json:"ip"`
	IO          string         `json:"io"`
	Tasks       uint32         `json:"tasks"`
	TasksLimit  uint32         `json:"tasksLimit"`
	MemoryPeak  uint64         `json:"memoryPeak"`
	CPUTime     string         `json:"cpuTime"`
	CGroup      string         `json:"cGroup"`
	Processes   []string       `json:"processes"` // List of processes
}

type SystemdServiceList struct {
	Services []SystemdService `json:"services"`
	Count    int              `json:"count"`
}
