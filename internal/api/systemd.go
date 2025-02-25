package api

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/Keyruu/sirberus/internal/systemd"
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
	rg.GET("/services", h.listServices)
	rg.GET("/services/:name", h.getService)
	rg.GET("/services/:name/stream", h.streamService)
	rg.GET("/services/:name/logs", h.streamServiceLogs)
	rg.POST("/services/:name/start", h.startService)
	rg.POST("/services/:name/stop", h.stopService)
	rg.POST("/services/:name/restart", h.restartService)
}

// handleError handles common error cases for HTTP endpoints
func (h *SystemdHandler) handleError(c *gin.Context, err error, name string, operation string) bool {
	if err == nil {
		return false
	}

	if strings.Contains(err.Error(), "not found") {
		c.JSON(http.StatusNotFound, gin.H{
			"error": fmt.Sprintf("Service %s not found", name),
		})
		return true
	}

	h.logger.Error(fmt.Sprintf("failed to %s service", operation),
		"service", name,
		"error", err)
	c.JSON(http.StatusInternalServerError, gin.H{
		"error": err.Error(),
	})
	return true
}

func (h *SystemdHandler) startService(c *gin.Context) {
	name := getServiceName(c.Param("name"))

	if err := h.service.StartUnit(name); h.handleError(c, err, name, "start") {
		return
	}

	h.logger.Info("successfully started service",
		"service", name)
	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Service %s started successfully", name),
	})
}

func (h *SystemdHandler) stopService(c *gin.Context) {
	name := getServiceName(c.Param("name"))

	if err := h.service.StopUnit(name); h.handleError(c, err, name, "stop") {
		return
	}

	h.logger.Info("successfully stopped service",
		"service", name)
	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Service %s stopped successfully", name),
	})
}

func (h *SystemdHandler) restartService(c *gin.Context) {
	name := getServiceName(c.Param("name"))

	if err := h.service.RestartUnit(name); h.handleError(c, err, name, "restart") {
		return
	}

	h.logger.Info("successfully restarted service",
		"service", name)
	c.JSON(http.StatusOK, gin.H{
		"message": fmt.Sprintf("Service %s restarted successfully", name),
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
	c.Writer.Flush()
}

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
			c.SSEvent("error", fmt.Sprintf("Service %s not found", name))
			return err
		}
		h.logger.Error("failed to get service details",
			"service", name,
			"error", err)
		c.SSEvent("error", err.Error())
		return err
	}

	c.SSEvent("message", details)
	return nil
}

// streamServiceLogs streams logs from a systemd service using SSE
func (h *SystemdHandler) streamServiceLogs(c *gin.Context) {
	name := getServiceName(c.Param("name"))
	setupSSE(c)

	// Send an initial event to confirm connection
	c.SSEvent("info", fmt.Sprintf("Connected to log stream for %s", name))
	c.Writer.Flush()

	// Parse query parameters
	follow := true
	if followParam := c.Query("follow"); followParam == "false" {
		follow = false
	}

	numLines := 100 // Default to 100 lines
	if linesParam := c.Query("lines"); linesParam != "" {
		if n, err := fmt.Sscanf(linesParam, "%d", &numLines); err != nil || n != 1 {
			h.logger.Warn("invalid lines parameter", "value", linesParam)
			numLines = 100
		}
	}

	// Create a context that will be canceled when the client disconnects
	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	// Start streaming logs
	logCh, errCh := h.service.StreamServiceLogs(ctx, name, follow, numLines)

	h.logger.Info("started streaming logs",
		"service", name,
		"follow", follow,
		"lines", numLines)

	// Send logs to the client
	for {
		select {
		case log, ok := <-logCh:
			if !ok {
				h.logger.Info("log channel closed",
					"service", name)
				c.SSEvent("info", "Log stream ended")
				c.Writer.Flush()
				return
			}
			c.SSEvent("log", log)
			c.Writer.Flush()
		case err, ok := <-errCh:
			if !ok {
				continue
			}
			h.logger.Error("error streaming logs",
				"service", name,
				"error", err)
			c.SSEvent("error", err.Error())
			c.Writer.Flush()
			return
		case <-ctx.Done():
			h.logger.Info("client disconnected from log stream",
				"service", name)
			return
		}
	}
}

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

func (h *SystemdHandler) listServices(c *gin.Context) {
	services, err := h.service.ListUnits()
	if err != nil {
		h.logger.Error("failed to list services", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	h.logger.Info("successfully listed services", "count", len(services.Services))
	c.JSON(http.StatusOK, services)
}
