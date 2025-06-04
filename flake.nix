{
  description = "Development Nix flake for OpenAI Codex CLI";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system: let
      pkgs = import nixpkgs { inherit system; };
      node = pkgs.nodejs_22;
    in rec {
      packages = {
        codex-sdk = pkgs.buildNpmPackage rec {
          pname       = "codex-sdk";
          version     = "0.1.0";
          src         = self + "/codex-sdk";
          npmDepsHash = "sha256-riVXC7T9zgUBUazH5Wq7+MjU1FepLkp9kHLSq+ZVqbs=";
          nodejs      = node;
          npmInstallFlags = [ "--frozen-lockfile" ];
          meta = with pkgs.lib; {
            description = "OpenAI Codex command‑line interface";
            license     = licenses.asl20;
            homepage    = "https://github.com/openai/codex";
          };
        };
      };
      defaultPackage = packages.codex-sdk;
      devShell = pkgs.mkShell {
        name        = "codex-sdk-dev";
        buildInputs = [
          node
        ];
        shellHook = ''
          echo "Entering development shell for codex-sdk"
          cd codex-sdk
          npm ci
          npm run build
          export PATH=$PWD/node_modules/.bin:$PATH
          alias codex="node $PWD/dist/cli.js"
        '';
      };
      apps = {
        codex = {
          type    = "app";
          program = "${packages.codex-sdk}/bin/codex";
        };
      };
    });
}
