const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const outDir = path.join(__dirname, "..", "server_dist");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

execSync(
  "npx esbuild server/src/main.ts --platform=node --packages=external --bundle --format=esm --outfile=server_dist/index.js",
  { stdio: "inherit", cwd: path.join(__dirname, "..") }
);

console.log("Server build complete: server_dist/index.js");
