import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(currentDir, "..");
const outputDir = path.join(projectRoot, "static-build");

const resolvedOutputDir = path.resolve(outputDir);
if (!resolvedOutputDir.startsWith(path.resolve(projectRoot))) {
  throw new Error("Output directory must be within the project directory");
}

if (fs.existsSync(resolvedOutputDir)) {
  fs.rmSync(resolvedOutputDir, { recursive: true });
}

/* eslint-disable no-console -- Build script needs console output */
console.log("Building Expo static bundles...");

execSync(
  `npx expo export --output-dir static-build --platform all`,
  { stdio: "inherit", cwd: projectRoot },
);

console.log("Expo static build complete: static-build/");
