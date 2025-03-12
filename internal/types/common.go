package types

type Message struct {
	Message string `json:"message"`
}

type PathParam struct {
	Name string `query:"name"`
}

// ErrorResponse represents a standardized error response
type ErrorResponse struct {
	Error string `json:"error"`
}

// LogEntry represents a single log entry for streaming
type LogEntry struct {
	Content string `json:"content"`
	Time    string `json:"time,omitempty"`
}

// SSEvent represents a server-sent event
type SSEvent struct {
	Type    string `json:"-"` // Not serialized, used for event type
	Content any    `json:"content"`
}
