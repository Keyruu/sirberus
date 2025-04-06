package api

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/Keyruu/sirberus/internal/api/common"
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
	rg.GET("/:name/logs", h.streamServiceLogs)
	rg.POST("/:name/start", h.startService)
	rg.POST("/:name/stop", h.stopService)
	rg.POST("/:name/restart", h.restartService)
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

	err := h.service.StartUnit(name)
	if common.HandleError(c, err, name, "start service", h.logger, "Service %s not found") {
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

	err := h.service.StopUnit(name)
	if common.HandleError(c, err, name, "stop service", h.logger, "Service %s not found") {
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

	err := h.service.RestartUnit(name)
	if common.HandleError(c, err, name, "restart service", h.logger, "Service %s not found") {
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

// @Summary		Stream service logs
// @Description	Stream logs from a systemd service (always includes real-time updates)
// @Tags			systemd, sse
// @Produce		text/event-stream
// @Param			name	path		string	true	"Service name"
// @Param			lines	query		integer	false	"Number of historical log lines to return before streaming new ones"	default(100)
// @Success		200		{object}	types.SSEvent
// @Failure		404		{object}	types.SSEvent
// @Failure		500		{object}	types.SSEvent
// @Router			/systemd/{name}/logs [get]
func (h *SystemdHandler) streamServiceLogs(c *gin.Context) {
	name := getServiceName(c.Param("name"))
	common.SetupSSE(c)

	numLines := common.ParseLogQueryParams(c, h.logger)

	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	// Always use follow=true as we always want real-time updates
	logCh, errCh := h.service.StreamServiceLogs(ctx, name, true, numLines)

	h.logger.Info("started streaming logs",
		"service", name,
		"lines", numLines)

	h.handleLogStreaming(ctx, c, logCh, errCh, name)
}

func (h *SystemdHandler) handleLogStreaming(
	ctx context.Context,
	c *gin.Context,
	logCh <-chan string,
	errCh <-chan error,
	serviceName string,
) {
	common.HandleStreamingOutput(ctx, c, logCh, errCh, serviceName, h.logger)
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
	if common.HandleError(c, err, name, "get details for service", h.logger, "Service %s not found") {
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
	if common.HandleError(c, err, "", "list services", h.logger, "") {
		return
	}

	h.logger.Info("successfully listed services", "count", len(services.Services))
	c.JSON(http.StatusOK, services)
}
