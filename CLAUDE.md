# Sirberus Development Guidelines

## Build/Lint/Test Commands
- **Generate OpenAPI**: `just gen-swagger`
- **Generate TypeScript API**: `just gen-api` or `cd web && pnpm gen:api`
- **Generate Both**: `just gen-all`
- **Run Go Tests**: `go test ./internal/...` or single test: `go test -v ./internal/systemd -run TestFunctionName`
- **Web Development**: `cd web && pnpm dev`
- **Web Build**: `cd web && pnpm build`
- **Web Lint**: `cd web && pnpm lint`

## Backend (Go) Guidelines
- Use Go 1.23+
- Follow Go idioms and conventions for naming, error handling, and package structure
- Use standard library where possible, minimize external dependencies
- Self-documenting code with minimal inline comments
- Modular, testable, and maintainable code with clear separation of concerns
- Add swag annotations for OpenAPI compatibility
- Security best practices: input validation, proper error handling, secure headers

## Frontend (React/TypeScript) Guidelines
- Use pnpm for package management
- Functional components and hooks (no classes)
- TypeScript interfaces over types
- Function keyword for pure functions
- Mobile-first responsive design with Tailwind CSS and Shadcn UI
- React Router v6 with nested routes
- Early error handling with guard clauses
- Component files in kebab-case, component names in PascalCase
- Optimize performance: minimize useEffect/useState, use React.lazy
- Always respect ESLint and Prettier configurations