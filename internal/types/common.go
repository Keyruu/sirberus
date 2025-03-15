package types

type Message struct {
	Message string `json:"message"`
} // @name Message

type PathParam struct {
	Name string `query:"name"`
} // @name PathParam

// ErrorResponse represents a standardized error response
type ErrorResponse struct {
	Error string `json:"error"`
} // @name ErrorResponse

// LogEntry represents a single log entry for streaming
type LogEntry struct {
	Content string `json:"content"`
	Time    string `json:"time,omitempty"`
} // @name LogEntry

// SSEvent represents a server-sent event
type SSEvent struct {
	Type    string `json:"-"` // Not serialized, used for event type
	Content any    `json:"content"`
} // @name SSEvent
