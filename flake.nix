{
  description = "SierraDB Inspector - Web interface for exploring events in SierraDB";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
        
        sierradb-inspector = pkgs.callPackage ./default.nix { };
        
      in {
        packages = {
          default = sierradb-inspector;
          sierradb-inspector = sierradb-inspector;
        };

        apps = {
          default = {
            type = "app";
            program = "${sierradb-inspector}/bin/sierradb-inspector";
          };
          sierradb-inspector = {
            type = "app"; 
            program = "${sierradb-inspector}/bin/sierradb-inspector";
          };
        };

        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [
            nodejs
            npm
            git
          ];
          
          shellHook = ''
            echo "SierraDB Inspector development environment"
            echo "Run 'npm run dev' to start development server"
            echo "Run 'nix build' to build the package"
            echo "Run 'nix run' to run the built package"
          '';
        };

        # For backwards compatibility
        defaultPackage = sierradb-inspector;
        defaultApp = {
          type = "app";
          program = "${sierradb-inspector}/bin/sierradb-inspector";
        };
      });
}