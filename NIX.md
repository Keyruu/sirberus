# Nix Build Instructions

This project includes a Nix flake for reproducible builds and development environments.

## Prerequisites

- [Nix](https://nixos.org/download.html) with flakes enabled
- Git (the flake needs to be in a git repository)

## Quick Start

```bash
# Build the complete application (Go backend + React frontend)
nix build

# Run the application
nix run

# Enter development environment
nix develop
```

## Building Options

### 🚀 Complete Application (Recommended)

```bash
nix build
```

**Fully Automated Build:**

- ✅ Builds React frontend from source using pnpm
- ✅ Embeds the built frontend into Go binary
- ✅ Single command builds everything
- ✅ No manual steps required

### 🔧 Backend Only

```bash
nix build .#sirberus-backend
```

Builds only the Go backend with basic web interface (smallest build).

### 🎯 Individual Components

Build specific parts of the application:

```bash
# Build only the React frontend
nix build .#web

# Build only the Go backend (with minimal UI)
nix build .#backend

# The default build includes both automatically
nix build
```

## Development Environment

### Enter Development Shell

```bash
nix develop
```

**Includes all development tools:**

- 🐹 Go 1.24+ with language server
- 📦 Node.js 20 + pnpm
- 🔧 just, git, curl, jq, httpie
- 🐳 Docker support
- 🔨 systemd development headers
- 🎨 Nix formatting tools

### Development Workflow

```bash
# Generate API specs and TypeScript client
just gen-all

# Run Go tests
go test ./internal/...

# Start React dev server (port 5173)
cd web && pnpm dev

# Start Go server (port 9733) 
go run cmd/app/main.go

# Or run both with concurrently
cd web && pnpm run dev-all
```

## Running the Application

### Using Nix

```bash
# Run default build
nix run

# Run backend-only build
nix run .#backend-only
```

### Direct Execution

```bash
# After building
./result/bin/app

# The server runs on port 9733
# Web UI: http://localhost:9733
# API: http://localhost:9733/api
# Swagger: http://localhost:9733/api/swagger/index.html
```

## Build Outputs

The built application creates a `result` symlink:

- `result/bin/app` - Main Sirberus binary
- Web assets are embedded in the binary
- Single-file deployment ready

## Features

### 🎨 Enhanced Web Interface

- **Full React Frontend** (when `web/dist` exists)
- **Enhanced Minimal UI** (fallback with modern design)
- **API Documentation** (always available at `/api/swagger`)

### 🔧 Development Features

- **Hot Reload** - React dev server with API proxy
- **Code Generation** - OpenAPI → TypeScript client
- **Testing** - Go test suite integration
- **Linting** - Go and TypeScript linting tools

### 📦 Deployment Options

- **Single Binary** - Everything embedded
- **Container Ready** - Works in Docker/Podman
- **systemd Integration** - Native systemd service management

## Troubleshooting

### Git Repository Required

```bash
git add flake.nix  # Add flake to git
```

### Network Issues During Build

The flake avoids network access during builds by:

- Using pre-built `web/dist` when available
- Falling back to embedded minimal UI
- All dependencies fetched through Nix

### Force Rebuild

```bash
nix build --rebuild
```

### Clean Build Environment

```bash
rm -f result*
nix store gc
nix build
```

### Check Build Status

```bash
# Show what will be built
nix build --dry-run

# Show flake structure
nix flake show

# Check development shell
nix develop --command echo "Shell works!"
```

## Advanced Usage

### Custom Build Variants

```bash
# Build specific packages
nix build .#sirberus          # Complete app
nix build .#sirberus-backend  # Backend only

# Run specific apps
nix run .#default       # Complete app
nix run .#backend-only  # Backend only
```

### Integration with CI/CD

```bash
# In CI environments
nix build --no-sandbox  # If needed
nix flake check         # Validate flake
```

### Cross-Platform Builds

The flake supports multiple architectures:

- `x86_64-linux` (primary)
- `aarch64-linux` (ARM64)
- `x86_64-darwin` (macOS Intel)
- `aarch64-darwin` (macOS Apple Silicon)

