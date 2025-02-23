package api

import (
	"log/slog"
	"net/http"

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

func (h *SystemdHandler) Close() {
	if h.service != nil {
		h.service.Close()
	}
}

func (h *SystemdHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("/services", h.listServices)
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
