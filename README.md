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
- Docker (optional, for container deployment)

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

## License

This project is licensed under the GNU Affero General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.