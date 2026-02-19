import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(currentDir, "..", "server_dist");

// Validate and resolve output directory path
const resolvedOutDir = path.resolve(outDir);
if (!resolvedOutDir.startsWith(process.cwd())) {
  throw new Error("Output directory must be within the project directory");
}

if (!fs.existsSync(resolvedOutDir)) {
  fs.mkdirSync(resolvedOutDir, { recursive: true });
}

execSync(
  "npx esbuild server/src/main.ts --platform=node --packages=external --bundle --format=esm --outfile=server_dist/index.js",
  { stdio: "inherit", cwd: path.join(currentDir, "..") },
);

/* eslint-disable no-console -- Build script needs console output */
console.log("Server build complete: server_dist/index.js");
