package api

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/Keyruu/sirberus/internal/systemd"
	"github.com/Keyruu/sirberus/internal/types"
	"github.com/gin-gonic/gin"
)

type SystemdHandler struct {
	service *systemd.SystemdService
	logger  *slog.Logger
}

func NewSystemdHandler(logger *slog.Logger) (*SystemdHandler, error) {
	handlerLogger := logger.With("component", "systemd_handler")
	service, err := systemd.NewSystemdService(handlerLogger)
	if err != nil {
		handlerLogger.Error("failed to create systemd service", "error", err)
		return nil, err
	}

	return &SystemdHandler{
		service: service,
		logger:  handlerLogger,
	}, nil
}

func (h *SystemdHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("", h.listServices)
	rg.GET("/:name", h.getService)
	rg.GET("/:name/stream", h.streamService)
	rg.GET("/:name/logs", h.streamServiceLogs)
	rg.POST("/:name/start", h.startService)
	rg.POST("/:name/stop", h.stopService)
	rg.POST("/:name/restart", h.restartService)
}

func (h *SystemdHandler) handleError(c *gin.Context, err error, name string, operation string) bool {
	if err == nil {
		return false
	}

	if strings.Contains(err.Error(), "not found") {
		c.JSON(http.StatusNotFound, types.ErrorResponse{
			Error: fmt.Sprintf("Service %s not found", name),
		})
		return true
	}

	h.logger.Error(fmt.Sprintf("failed to %s service", operation),
		"service", name,
		"error", err)
	c.JSON(http.StatusInternalServerError, types.ErrorResponse{
		Error: err.Error(),
	})
	return true
}

// @Summary		Start service
// @Description	Start a systemd service
// @Tags			systemd
// @Produce		json
// @Param			name	path		string	true	"Service name"
// @Success		200		{object}	types.Message
// @Failure		404		{object}	types.ErrorResponse
// @Failure		500		{object}	types.ErrorResponse
// @Router			/systemd/{name}/start [post]
func (h *SystemdHandler) startService(c *gin.Context) {
	name := getServiceName(c.Param("name"))

	if err := h.service.StartUnit(name); h.handleError(c, err, name, "start") {
		return
	}

	h.logger.Info("successfully started service",
		"service", name)
	c.JSON(http.StatusOK, types.Message{
		Message: fmt.Sprintf("Service %s started successfully", name),
	})
}

// @Summary		Stop service
// @Description	Stop a systemd service
// @Tags			systemd
// @Produce		json
// @Param			name	path		string	true	"Service name"
// @Success		200		{object}	types.Message
// @Failure		404		{object}	types.ErrorResponse
// @Failure		500		{object}	types.ErrorResponse
// @Router			/systemd/{name}/stop [post]
func (h *SystemdHandler) stopService(c *gin.Context) {
	name := getServiceName(c.Param("name"))

	if err := h.service.StopUnit(name); h.handleError(c, err, name, "stop") {
		return
	}

	h.logger.Info("successfully stopped service",
		"service", name)
	c.JSON(http.StatusOK, types.Message{
		Message: fmt.Sprintf("Service %s stopped successfully", name),
	})
}

// @Summary		Restart service
// @Description	Restart a systemd service
// @Tags			systemd
// @Produce		json
// @Param			name	path		string	true	"Service name"
// @Success		200		{object}	types.Message
// @Failure		404		{object}	types.ErrorResponse
// @Failure		500		{object}	types.ErrorResponse
// @Router			/systemd/{name}/restart [post]
func (h *SystemdHandler) restartService(c *gin.Context) {
	name := getServiceName(c.Param("name"))

	if err := h.service.RestartUnit(name); h.handleError(c, err, name, "restart") {
		return
	}

	h.logger.Info("successfully restarted service",
		"service", name)
	c.JSON(http.StatusOK, types.Message{
		Message: fmt.Sprintf("Service %s restarted successfully", name),
	})
}

func getServiceName(name string) string {
	if !strings.HasSuffix(name, ".service") {
		return name + ".service"
	}
	return name
}

func setupSSE(c *gin.Context) {
	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Transfer-Encoding", "chunked")
}

// @Summary		Stream service updates
// @Description	Stream real-time updates about a systemd service
// @Tags			systemd, sse
// @Produce		text/event-stream
// @Param			name	path		string	true	"Service name"
// @Success		200		{object}	types.SSEvent
// @Failure		404		{object}	types.SSEvent
// @Failure		500		{object}	types.SSEvent
// @Router			/systemd/{name}/stream [get]
func (h *SystemdHandler) streamService(c *gin.Context) {
	name := getServiceName(c.Param("name"))
	setupSSE(c)

	clientGone := c.Request.Context().Done()

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	if err := h.sendServiceDetails(c, name); err != nil {
		h.logger.Error("failed to send initial service details",
			"service", name,
			"error", err)
		return
	}

	for {
		select {
		case <-ticker.C:
			if err := h.sendServiceDetails(c, name); err != nil {
				h.logger.Error("failed to send service details update",
					"service", name,
					"error", err)
				return
			}
			c.Writer.Flush()
		case <-clientGone:
			h.logger.Info("client disconnected from service stream",
				"service", name)
			return
		}
	}
}

func (h *SystemdHandler) sendServiceDetails(c *gin.Context, name string) error {
	details, err := h.service.GetUnitDetails(name)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			event := types.SSEvent{
				Type:    "error",
				Content: fmt.Sprintf("Service %s not found", name),
			}
			c.SSEvent(event.Type, event.Content)
			return err
		}
		h.logger.Error("failed to get service details",
			"service", name,
			"error", err)
		event := types.SSEvent{
			Type:    "error",
			Content: err.Error(),
		}
		c.SSEvent(event.Type, event.Content)
		return err
	}

	event := types.SSEvent{
		Type:    "message",
		Content: details,
	}
	c.SSEvent(event.Type, event.Content)
	return nil
}

const (
	defaultLogLines = 100
)

// @Summary		Stream service logs
// @Description	Stream logs from a systemd service
// @Tags			systemd, sse
// @Produce		text/event-stream
// @Param			name	path		string	true	"Service name"
// @Param			follow	query		boolean	false	"Follow logs in real-time"		default(true)
// @Param			lines	query		integer	false	"Number of log lines to return"	default(100)
// @Success		200		{object}	types.SSEvent
// @Failure		404		{object}	types.SSEvent
// @Failure		500		{object}	types.SSEvent
// @Router			/systemd/{name}/logs [get]
func (h *SystemdHandler) streamServiceLogs(c *gin.Context) {
	name := getServiceName(c.Param("name"))
	setupSSE(c)

	follow, numLines := h.parseLogQueryParams(c)

	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	logCh, errCh := h.service.StreamServiceLogs(ctx, name, follow, numLines)

	h.logger.Info("started streaming logs",
		"service", name,
		"follow", follow,
		"lines", numLines)

	h.handleLogStreaming(ctx, c, logCh, errCh, name)
}

func (h *SystemdHandler) parseLogQueryParams(c *gin.Context) (bool, int) {
	follow := true
	if followParam := c.Query("follow"); followParam == "false" {
		follow = false
	}

	numLines := defaultLogLines
	if linesParam := c.Query("lines"); linesParam != "" {
		if n, err := fmt.Sscanf(linesParam, "%d", &numLines); err != nil || n != 1 {
			h.logger.Warn("invalid lines parameter, using default",
				"value", linesParam,
				"default", defaultLogLines)
			numLines = defaultLogLines
		}
	}

	return follow, numLines
}

func (h *SystemdHandler) handleLogStreaming(
	ctx context.Context,
	c *gin.Context,
	logCh <-chan string,
	errCh <-chan error,
	serviceName string,
) {
	for {
		select {
		case log, ok := <-logCh:
			if !ok {
				h.logger.Info("log channel closed", "service", serviceName)
				return
			}
			logEvent := types.SSEvent{
				Type:    "log",
				Content: log,
			}
			c.SSEvent(logEvent.Type, logEvent.Content)
			c.Writer.Flush()
		case err, ok := <-errCh:
			if !ok {
				continue
			}
			h.logger.Error("error streaming logs",
				"service", serviceName,
				"error", err)
			errorEvent := types.SSEvent{
				Type:    "error",
				Content: err.Error(),
			}
			c.SSEvent(errorEvent.Type, errorEvent.Content)
			c.Writer.Flush()
			return
		case <-ctx.Done():
			h.logger.Info("client disconnected from log stream",
				"service", serviceName)
			return
		}
	}
}

// @Summary		Get systemd service details
// @Description	Get detailed information about a specific systemd service
// @Tags			systemd
// @Produce		json
// @Param			name	path		string	true	"Service name"
// @Success		200		{object}	types.SystemdServiceDetails
// @Failure		404		{object}	types.ErrorResponse
// @Failure		500		{object}	types.ErrorResponse
// @Router			/systemd/{name} [get]
func (h *SystemdHandler) getService(c *gin.Context) {
	name := getServiceName(c.Param("name"))
	details, err := h.service.GetUnitDetails(name)
	if h.handleError(c, err, name, "get details for") {
		return
	}

	h.logger.Info("successfully got service details",
		"service", name)
	c.JSON(http.StatusOK, details)
}

// @Summary		List systemd services
// @Description	Get a list of all systemd services
// @Tags			systemd
// @Produce		json
// @Success		200	{object}	types.SystemdServiceList
// @Failure		500	{object}	types.ErrorResponse
// @Router			/systemd [get]
func (h *SystemdHandler) listServices(c *gin.Context) {
	services, err := h.service.ListUnits()
	if err != nil {
		h.logger.Error("failed to list services", "error", err)
		c.JSON(http.StatusInternalServerError, types.ErrorResponse{
			Error: err.Error(),
		})
		return
	}

	h.logger.Info("successfully listed services", "count", len(services.Services))
	c.JSON(http.StatusOK, services)
}
