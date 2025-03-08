package api

import (
	"log/slog"
	"net/http"

	"github.com/Keyruu/sirberus/internal/container"
	"github.com/gin-gonic/gin"
)

type ContainerHandler struct {
	service *container.ContainerService
	logger  *slog.Logger
}

func NewContainerHandler(logger *slog.Logger) *ContainerHandler {
	handlerLogger := logger.With("component", "container_handler")
	service := container.NewContainerService(handlerLogger)

	return &ContainerHandler{
		service: service,
		logger:  handlerLogger,
	}
}

func (h *ContainerHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("", h.listContainers)
}

func (h *ContainerHandler) listContainers(c *gin.Context) {
	h.logger.Info("listing containers")

	containerList, err := h.service.ListContainers(c.Request.Context())
	if err != nil {
		h.logger.Error("failed to list containers", "error", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, containerList)
}
