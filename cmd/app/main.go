package main

import (
	"log/slog"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/Keyruu/sirberus/internal/api"
	"github.com/Keyruu/sirberus/web"
	"github.com/gin-gonic/gin"
)

func main() {
	// Initialize logger with structured output
	logger := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	}))
	slog.SetDefault(logger)

	port := ":9733"

	// Create gin router
	gin.SetMode(gin.ReleaseMode)
	router := gin.New()
	router.Use(gin.Recovery())

	// Initialize systemd handler
	systemdHandler, err := api.NewSystemdHandler(logger)
	if err != nil {
		logger.Error("failed to create systemd handler", "error", err)
		os.Exit(1)
	}

	// Register API routes first
	apiGroup := router.Group("/api")
	systemdGroup := apiGroup.Group("/systemd")
	systemdHandler.RegisterRoutes(systemdGroup)

	// Setup static file serving
	assetsFS, err := web.AssetsFS()
	if err != nil {
		logger.Error("failed to create assets file system", "error", err)
		os.Exit(1)
	}

	// Serve static files for any non-API routes
	router.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		if !strings.HasPrefix(path, "/api") {
			c.FileFromFS(path, http.FS(assetsFS))
			return
		}
		c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
	})

	logger.Info("🚀 Starting server on port", "port", port)
	logger.Info("👂 Listening for incoming requests...")

	server := &http.Server{
		Addr:         port,
		Handler:      router,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
	}

	if err := server.ListenAndServe(); err != nil {
		logger.Error("server stopped", "error", err)
		os.Exit(1)
	}
}
