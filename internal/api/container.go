package api

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"

	"github.com/Keyruu/sirberus/internal/api/common"
	"github.com/Keyruu/sirberus/internal/container"
	"github.com/Keyruu/sirberus/internal/types"
	"github.com/gin-gonic/gin"
)

type ContainerHandler struct {
	service *container.ContainerService
	logger  *slog.Logger
}

func NewContainerHandler(logger *slog.Logger) (*ContainerHandler, error) {
	handlerLogger := logger.With("component", "container_handler")
	service, err := container.NewContainerService(handlerLogger)
	if err != nil {
		return nil, err
	}

	return &ContainerHandler{
		service: service,
		logger:  handlerLogger,
	}, nil
}

func (h *ContainerHandler) RegisterRoutes(rg *gin.RouterGroup) {
	rg.GET("", h.listContainers)
	rg.GET("/:id", h.getContainer)
	rg.GET("/:id/logs", h.streamContainerLogs)
	rg.POST("/:id/start", h.startContainer)
	rg.POST("/:id/stop", h.stopContainer)
	rg.POST("/:id/restart", h.restartContainer)
	rg.POST("/:id/exec", h.execInContainer)
}

// @Summary		List containers
// @Description	Get a list of all containers
// @Tags			containers
// @Produce		json
// @Success		200	{object}	types.ContainerList
// @Failure		500	{object}	types.ErrorResponse
// @Router			/container [get]
func (h *ContainerHandler) listContainers(c *gin.Context) {
	h.logger.Info("listing containers")

	containerList, err := h.service.ListContainers(c.Request.Context())
	if common.HandleError(c, err, "", "list containers", h.logger, "") {
		return
	}

	c.JSON(http.StatusOK, containerList)
}

// @Summary     Stream container logs
// @Description Stream logs from a container (always includes real-time updates)
// @Tags        containers, sse
// @Produce     text/event-stream
// @Param       id     path     string  true  "Container ID"
// @Param       lines  query    integer false "Number of historical log lines to return before streaming new ones" default(100)
// @Success     200    {object} types.SSEvent
// @Failure     404    {object} types.SSEvent
// @Failure     500    {object} types.SSEvent
// @Router      /container/{id}/logs [get]
func (h *ContainerHandler) streamContainerLogs(c *gin.Context) {
	id := c.Param("id")
	common.SetupSSE(c)

	numLines := common.ParseLogQueryParams(c, h.logger)

	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	// Always use follow=true as we always want real-time updates
	logCh, errCh := h.service.StreamContainerLogs(ctx, id, true, numLines)

	h.logger.Info("started streaming logs",
		"container", id,
		"lines", numLines)

	common.HandleStreamingOutput(ctx, c, logCh, errCh, id, h.logger)
}

// @Summary     Execute command in container
// @Description Execute a command in a container and stream the output
// @Tags        containers, sse
// @Accept      json
// @Produce     text/event-stream
// @Param       id      path     string                  true "Container ID"
// @Param       command body     types.ContainerExecRequest true "Command to execute"
// @Success     200     {object} types.SSEvent
// @Failure     404     {object} types.SSEvent
// @Failure     500     {object} types.SSEvent
// @Router      /container/{id}/exec [post]
func (h *ContainerHandler) execInContainer(c *gin.Context) {
	id := c.Param("id")

	var execReq types.ContainerExecRequest
	if err := c.ShouldBindJSON(&execReq); err != nil {
		c.JSON(http.StatusBadRequest, types.ErrorResponse{
			Error: fmt.Sprintf("Invalid request: %s", err.Error()),
		})
		return
	}

	if execReq.Command == "" {
		c.JSON(http.StatusBadRequest, types.ErrorResponse{
			Error: "Command cannot be empty",
		})
		return
	}

	common.SetupSSE(c)

	ctx, cancel := context.WithCancel(c.Request.Context())
	defer cancel()

	outputCh, errCh := h.service.ExecInContainer(ctx, id, execReq.Command)

	h.logger.Info("executing command in container",
		"container", id,
		"command", execReq.Command)

	common.HandleStreamingOutput(ctx, c, outputCh, errCh, id, h.logger)
}

// @Summary     Get container details
// @Description Get detailed information about a specific container
// @Tags        containers
// @Produce     json
// @Param       id   path     string true "Container ID"
// @Success     200  {object} types.Container
// @Failure     404  {object} types.ErrorResponse
// @Failure     500  {object} types.ErrorResponse
// @Router      /container/{id} [get]
func (h *ContainerHandler) getContainer(c *gin.Context) {
	id := c.Param("id")
	h.logger.Info("getting container details", "id", id)

	container, err := h.service.GetContainerDetails(c.Request.Context(), id)
	if common.HandleError(c, err, id, "get details for container", h.logger, "Container %s not found") {
		return
	}

	c.JSON(http.StatusOK, container)
}

// @Summary     Start container
// @Description Start a container
// @Tags        containers
// @Produce     json
// @Param       id   path     string true "Container ID"
// @Success     200  {object} types.Message
// @Failure     404  {object} types.ErrorResponse
// @Failure     500  {object} types.ErrorResponse
// @Router      /container/{id}/start [post]
func (h *ContainerHandler) startContainer(c *gin.Context) {
	id := c.Param("id")
	h.logger.Info("starting container", "id", id)

	err := h.service.StartContainer(c.Request.Context(), id)
	if common.HandleError(c, err, id, "start container", h.logger, "Container %s not found") {
		return
	}

	c.JSON(http.StatusOK, types.Message{
		Message: fmt.Sprintf("Container %s started successfully", id),
	})
}

// @Summary     Stop container
// @Description Stop a container
// @Tags        containers
// @Produce     json
// @Param       id   path     string true "Container ID"
// @Success     200  {object} types.Message
// @Failure     404  {object} types.ErrorResponse
// @Failure     500  {object} types.ErrorResponse
// @Router      /container/{id}/stop [post]
func (h *ContainerHandler) stopContainer(c *gin.Context) {
	id := c.Param("id")
	h.logger.Info("stopping container", "id", id)

	err := h.service.StopContainer(c.Request.Context(), id)
	if common.HandleError(c, err, id, "stop container", h.logger, "Container %s not found") {
		return
	}

	c.JSON(http.StatusOK, types.Message{
		Message: fmt.Sprintf("Container %s stopped successfully", id),
	})
}

// @Summary     Restart container
// @Description Restart a container
// @Tags        containers
// @Produce     json
// @Param       id   path     string true "Container ID"
// @Success     200  {object} types.Message
// @Failure     404  {object} types.ErrorResponse
// @Failure     500  {object} types.ErrorResponse
// @Router      /container/{id}/restart [post]
func (h *ContainerHandler) restartContainer(c *gin.Context) {
	id := c.Param("id")
	h.logger.Info("restarting container", "id", id)

	err := h.service.RestartContainer(c.Request.Context(), id)
	if common.HandleError(c, err, id, "restart container", h.logger, "Container %s not found") {
		return
	}

	c.JSON(http.StatusOK, types.Message{
		Message: fmt.Sprintf("Container %s restarted successfully", id),
	})
}
