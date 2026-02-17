#!/usr/bin/env node

const { spawnSync } = require("node:child_process");

function isTrue(value) {
  return value === "1" || value === "true";
}

const shouldSkip =
  isTrue(process.env.CI) ||
  isTrue(process.env.EAS_BUILD) ||
  process.env.NODE_ENV === "production" ||
  process.env.npm_config_production === "true";

if (shouldSkip) {
  process.exit(0);
}

const result = spawnSync("husky", [], {
  stdio: "inherit",
  shell: process.platform === "win32",
});

if (result.error) {
  if (result.error.code === "ENOENT") {
    // husky is optional in CI/remote envs where devDependencies are not installed
    process.exit(0);
  }
  process.stderr.write(`[prepare] husky failed: ${result.error.message}\n`);
  process.exit(1);
}

process.exit(result.status ?? 0);
