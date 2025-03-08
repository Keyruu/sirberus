# Sirberus

<div align="center">
  <img src="web/public/sirberus-logo.png" alt="Sirberus Logo" width="200">
</div>

## Overview

Sirberus is a unified control plane for managing systemd services and containers. It provides a single, intuitive interface for controlling and monitoring your system services and containerized applications.

## Features

- **Service Management**
  - Start, stop, enable, and disable systemd services
  - View service status and logs
  - Monitor service health
  - Manage service configuration

- **Container Control**
  - Start and stop containers
  - Execute commands inside containers
  - View container logs and status
  - Monitor container health
  - Manage container lifecycle

## Project Structure

```
├── app                 # Application core
├── cmd                 # Command-line entry points
├── internal           
│   ├── api            # API implementations
│   ├── container      # Container management
│   ├── frontend       # Frontend service
│   ├── systemd        # Systemd integration
│   └── types          # Shared type definitions
└── web                # Frontend application
```

## Prerequisites

- Go 1.23 or higher
- Node.js and pnpm
- Docker or Podman (for container management)

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/sirberus.git
   cd sirberus
   ```

2. Install backend dependencies:
   ```bash
   go mod download
   ```

3. Install frontend dependencies:
   ```bash
   cd web
   pnpm install
   ```

## Configuration

### Environment Variables

Sirberus can be configured using the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `DOCKER_HOST` | Docker/Podman socket URL | Auto-detected (`unix:///var/run/docker.sock`, `unix:///run/podman/podman.sock`, or `unix:///run/user/1000/podman/podman.sock`) |

## Development

**Important**: The backend serves the built frontend files, so you must build the frontend first before starting the backend.

1. Build the frontend:
   ```bash
   cd web
   pnpm build
   cd ..
   ```

2. Start the backend server:
   ```bash
   go run cmd/app/main.go
   ```

For frontend development with hot reload:
```bash
cd web
pnpm dev
```

## Building

1. Build the frontend (required before building the backend):
   ```bash
   cd web
   pnpm build
   cd ..
   ```

2. Build the backend:
   ```bash
   go build -o sirberus cmd/app/main.go
   ```

## API Endpoints

Sirberus provides a RESTful API for managing systemd services and containers.

### Systemd Services

- `GET /api/systemd/services` - List all systemd services
- `GET /api/systemd/services/:name` - Get details of a specific service
- `GET /api/systemd/services/:name/stream` - Stream service status updates
- `GET /api/systemd/services/:name/logs` - Stream service logs
- `POST /api/systemd/services/:name/start` - Start a service
- `POST /api/systemd/services/:name/stop` - Stop a service
- `POST /api/systemd/services/:name/restart` - Restart a service

### Containers

- `GET /api/container/containers` - List all containers

## License

This project is licensed under the GNU Affero General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Testing

### Systemd Tests

The systemd package includes tests that use the actual system instead of mocks. These tests interact with real systemd services.

**Requirements:**
- Linux operating system with systemd
- Root privileges (sudo) for most tests
- Go 1.23 or later

```bash
# Run as root to enable all tests
sudo go test -v ./internal/systemd/...

# Run without root (some tests will be skipped)
go test -v ./internal/systemd/...
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.