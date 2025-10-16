{
  pkgs ? import <nixpkgs> { },
}:

pkgs.stdenv.mkDerivation {
  pname = "sierradb-inspector";
  version = "1.0.0";

  src = ./.;

  nativeBuildInputs = with pkgs; [ nodejs_24 ];

  # Allow network access for npm install
  __impure = true;

  buildPhase = ''
    runHook preBuild

    # Install dependencies for all packages
    npm ci
    cd client && npm ci && cd ..
    cd server && npm ci && cd ..
    cd shared && npm ci && cd ..

    # Build client
    cd client
    npm run build
    cd ..

    # Build server
    cd server
    npm run build
    cd ..

    runHook postBuild
  '';

  installPhase = ''
        runHook preInstall
        
        mkdir -p $out/lib/sierradb-inspector
        mkdir -p $out/bin
        
        # Copy server build output
        cp -r server/dist $out/lib/sierradb-inspector/
        cp -r server/node_modules $out/lib/sierradb-inspector/
        cp server/package.json $out/lib/sierradb-inspector/
        
        # Copy client build output to be served by server
        cp -r client/dist $out/lib/sierradb-inspector/public
        
        # Copy shared package
        cp -r shared/dist $out/lib/sierradb-inspector/shared
        
        # Create startup script
        cat > $out/bin/sierradb-inspector << EOF
    #!/bin/sh
    cd $out/lib/sierradb-inspector
    export NODE_PATH=$out/lib/sierradb-inspector/node_modules
    export PORT=\''${PORT:-3001}
    export SIERRADB_URL=\''${SIERRADB_URL:-redis://localhost:9090}
    exec ${pkgs.nodejs}/bin/node dist/index.js "\$@"
    EOF
        
        chmod +x $out/bin/sierradb-inspector
        
        runHook postInstall
  '';

  meta = with pkgs.lib; {
    description = "Web interface for exploring events in SierraDB";
    homepage = "https://github.com/tqwewe/sierradb-inspector";
    license = licenses.mit; # Adjust if different
    maintainers = [ ];
    platforms = platforms.all;
    mainProgram = "sierradb-inspector";
  };
}
