package main

import (
	"log/slog"
	"net/http"
	"os"
	"strings"

	_ "github.com/Keyruu/sirberus/docs"
	"github.com/Keyruu/sirberus/internal/api"
	"github.com/Keyruu/sirberus/internal/types"
	"github.com/Keyruu/sirberus/web"
	"github.com/gin-gonic/gin"
	sloggin "github.com/samber/slog-gin"
	swaggerFiles "github.com/swaggo/files"
	ginSwagger "github.com/swaggo/gin-swagger"
)

//	@title			Sirberus API
//	@version		1.0
//	@description	API for managing systemd services and containers
//	@BasePath		/api

func main() {
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	port := ":9733"

	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(sloggin.New(logger))
	router.Use(gin.Recovery())

	systemdHandler, err := api.NewSystemdHandler(logger)
	if err != nil {
		logger.Error("failed to create systemd handler", "error", err)
		os.Exit(1)
	}

	containerHandler := api.NewContainerHandler(logger)

	apiGroup := router.Group("/api")

	systemdGroup := apiGroup.Group("/systemd")
	systemdHandler.RegisterRoutes(systemdGroup)

	containerGroup := apiGroup.Group("/container")
	containerHandler.RegisterRoutes(containerGroup)

	apiGroup.GET("/swagger/*any", ginSwagger.WrapHandler(swaggerFiles.Handler))

	assetsFS, err := web.AssetsFS()
	if err != nil {
		logger.Error("failed to create assets file system", "error", err)
		os.Exit(1)
	}

	router.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		if !strings.HasPrefix(path, "/api") {
			c.FileFromFS(path, http.FS(assetsFS))
			return
		}
		c.JSON(http.StatusNotFound, types.ErrorResponse{
			Error: "Not found",
		})
	})

	logger.Info("starting server on port", "port", port)
	logger.Info("listening for incoming requests...")

	router.Run(port)
}
