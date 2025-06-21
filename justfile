# Generate OpenAPI specification
gen-swagger:
    docker run --rm -v $(pwd):/code ghcr.io/swaggo/swag:v1.16.4 init -g cmd/app/main.go

# Generate TypeScript API client
gen-api:
    cd web && pnpm gen:api

# Generate both OpenAPI specification and TypeScript API client
gen-all: gen-swagger gen-api

