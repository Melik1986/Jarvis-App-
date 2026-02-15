#!/bin/bash
echo "Building NestJS server..."
npx tsc -p server/tsconfig.json
echo "Starting production server..."
NODE_ENV=production node server/dist/server/src/main.js
