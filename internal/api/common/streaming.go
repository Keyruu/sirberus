package common

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/Keyruu/sirberus/internal/types"
	"github.com/gin-gonic/gin"
)

const (
	DefaultLogLines = 100
)

// SetupSSE configures response headers for Server-Sent Events
func SetupSSE(c *gin.Context) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Transfer-Encoding", "chunked")
}

// ParseLogQueryParams parses the 'lines' query parameter with a default value
func ParseLogQueryParams(c *gin.Context, logger *slog.Logger) int {
	numLines := DefaultLogLines
	if linesParam := c.Query("lines"); linesParam != "" {
		if n, err := fmt.Sscanf(linesParam, "%d", &numLines); err != nil || n != 1 {
			logger.Warn("invalid lines parameter, using default",
				"value", linesParam,
				"default", DefaultLogLines)
			numLines = DefaultLogLines
		}
	}
	return numLines
}

func HandleError(c *gin.Context, err error, id string, operation string, logger *slog.Logger, notFoundMsg string) bool {
	if err == nil {
		return false
	}

	if notFoundMsg != "" && (strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "No such")) {
		c.JSON(http.StatusNotFound, types.ErrorResponse{
			Error: fmt.Sprintf(notFoundMsg, id),
		})
		return true
	}

	logger.Error(fmt.Sprintf("failed to %s", operation),
		"id", id,
		"error", err)
	c.JSON(http.StatusInternalServerError, types.ErrorResponse{
		Error: err.Error(),
	})
	return true
}

// HandleStreamingOutput handles streaming output from a channel to SSE events
func HandleStreamingOutput(
	ctx context.Context,
	c *gin.Context,
	outputCh <-chan string,
	errCh <-chan error,
	id string,
	logger *slog.Logger,
) {
	// Create a heartbeat ticker to ensure the connection stays alive
	heartbeatTicker := time.NewTicker(5 * time.Second)
	defer heartbeatTicker.Stop()

	for {
		select {
		case output, ok := <-outputCh:
			if !ok {
				logger.Info("output channel closed", "id", id)
				return
			}
			event := types.SSEvent{
				Type:    "output",
				Content: output,
			}
			c.SSEvent(event.Type, event.Content)
			c.Writer.Flush()

		case err, ok := <-errCh:
			if !ok {
				continue
			}
			logger.Error("error streaming output",
				"id", id,
				"error", err)
			errorEvent := types.SSEvent{
				Type:    "error",
				Content: err.Error(),
			}
			c.SSEvent(errorEvent.Type, errorEvent.Content)
			c.Writer.Flush()

			// Don't return on error, try to continue streaming
			// Only return if the context is done
			select {
			case <-ctx.Done():
				return
			default:
				// Continue streaming
			}

		case <-heartbeatTicker.C:
			// Send a heartbeat event to keep the connection alive
			heartbeatEvent := types.SSEvent{
				Type:    "heartbeat",
				Content: time.Now().Format(time.RFC3339),
			}
			c.SSEvent(heartbeatEvent.Type, heartbeatEvent.Content)
			c.Writer.Flush()

		case <-ctx.Done():
			logger.Info("client disconnected from stream",
				"id", id)
			return
		}
	}
}
