{
  description = "Sirberus - systemd and container management tool";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # Build the web frontend using a fixed-output derivation
        web = pkgs.stdenv.mkDerivation {
          pname = "sirberus-web";
          version = "0.0.0";

          src = ./web;

          nativeBuildInputs = with pkgs; [
            nodejs_20
            pnpm
            cacert
          ];

          # Fixed-output derivation allows network access
          outputHashMode = "recursive";
          outputHashAlgo = "sha256";
          outputHash = "sha256-5QT0ca1sNUaXIu9JzoNs5hcqOWS12qruv0Gjtu7Y7Ho=";

          configurePhase = ''
            export HOME=$TMPDIR
            export SSL_CERT_FILE=${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt
            pnpm config set store-dir $TMPDIR/pnpm-store
          '';

          buildPhase = ''
            pnpm install --frozen-lockfile
            pnpm run build
          '';

          installPhase = ''
            mkdir -p $out
            cp -r dist/* $out/
          '';

          meta = with pkgs.lib; {
            description = "Sirberus React web frontend";
            license = licenses.mit;
          };
        };

        # Build the complete Go application with embedded frontend
        sirberus = pkgs.buildGoModule {
          pname = "sirberus";
          version = "0.0.0";

          src = ./.;

          vendorHash = "sha256-xPd0gcoORU3pI28GdkdSliOUCTKrlEiNDieofZO/Rf8=";

          subPackages = [ "cmd/app" ];

          buildInputs = with pkgs; [ systemd.dev ];
          nativeBuildInputs = with pkgs; [ pkg-config ];

          env.CGO_ENABLED = "1";

          # Embed the built web frontend
          preBuild = ''
            mkdir -p web/dist
            cp -r ${web}/* web/dist/
            echo "✅ Embedded React frontend built with Nix"
          '';

          meta = with pkgs.lib; {
            description = "Systemd and container management tool with embedded React frontend";
            homepage = "https://github.com/Keyruu/sirberus";
            license = licenses.mit;
            mainProgram = "app";
          };
        };

      in
      {
        packages = {
          # Default package - complete application with React frontend
          default = sirberus;

          # Individual components
          sirberus = sirberus;
          web = web;

          # Backend-only build for comparison/testing
          sirberus-backend = pkgs.buildGoModule {
            pname = "sirberus-backend";
            version = "0.0.0";

            src = ./.;

            vendorHash = "sha256-xPd0gcoORU3pI28GdkdSliOUCTKrlEiNDieofZO/Rf8=";

            subPackages = [ "cmd/app" ];

            buildInputs = with pkgs; [ systemd.dev ];
            nativeBuildInputs = with pkgs; [ pkg-config ];

            env.CGO_ENABLED = "1";

            preBuild = ''
                            mkdir -p web/dist
                            cat > web/dist/index.html << 'EOF'
              <!DOCTYPE html>
              <html lang="en">
              <head>
                  <meta charset="UTF-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1.0">
                  <title>Sirberus Backend</title>
                  <style>
                      body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; margin: 0; padding: 2rem; background: #f5f5f5; }
                      .container { max-width: 600px; margin: 0 auto; background: white; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                      h1 { color: #333; border-bottom: 2px solid #007acc; padding-bottom: 1rem; }
                      .api-link { display: inline-block; background: #007acc; color: white; padding: 0.75rem 1.5rem; border-radius: 6px; text-decoration: none; margin: 0.5rem 0; }
                      .api-link:hover { background: #005a9e; }
                  </style>
              </head>
              <body>
                  <div class="container">
                      <h1>🐺 Sirberus Backend</h1>
                      <p>Backend-only build without React frontend.</p>
                      <a href="/api/swagger/index.html" class="api-link">📚 API Documentation</a>
                      <a href="/api" class="api-link">🔌 REST API</a>
                  </div>
              </body>
              </html>
              EOF
            '';

            meta = {
              description = "Sirberus backend only";
              mainProgram = "app";
            };
          };
        };

        # Development shell
        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            # Go development
            go
            gopls
            gotools
            golangci-lint

            # Web development
            nodejs_20
            pnpm

            # Build tools
            just
            pkg-config
            git

            # System dependencies
            systemd.dev
            docker

            # Utilities
            curl
            jq
            httpie

            # Nix tools
            nixpkgs-fmt
            nil
          ];

          shellHook = ''
            echo "🐺 Sirberus Development Environment"
            echo "=================================="
            echo ""
            echo "📦 Available Tools:"
            echo "  • Go $(go version | cut -d' ' -f3)"
            echo "  • Node.js $(node --version)"
            echo "  • pnpm $(pnpm --version)"
            echo ""
            echo "🔧 Development Commands:"
            echo "  just gen-all          → Generate OpenAPI + TypeScript client"
            echo "  go test ./internal/... → Run Go tests"
            echo "  cd web && pnpm dev    → Start React dev server (port 5173)"
            echo "  go run cmd/app/main.go → Start Go backend (port 9733)"
            echo ""
            echo "🏗️  Nix Build Commands:"
            echo "  nix build             → Build complete app (Go backend + React frontend)"
            echo "  nix build .#web       → Build React frontend only"
            echo "  nix build .#sirberus-backend → Build Go backend only"
            echo "  nix run               → Run the complete application"
            echo ""
            echo "✨ The Nix build automatically builds both frontend and backend!"
            echo "   No need to manually run 'pnpm build' - Nix handles everything!"
          '';
        };

        # Application runner
        apps.default = flake-utils.lib.mkApp {
          drv = sirberus;
          exePath = "/bin/app";
        };
      }
    );
}
