#!/bin/sh
npx esbuild server/src/main.ts --platform=node --packages=external --bundle --format=esm --outfile=server_dist/index.js
echo "Server build complete: server_dist/index.js"
