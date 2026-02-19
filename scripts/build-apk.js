#!/usr/bin/env node

/**
 * APK Build Script for AXON App
 * This script helps build Android APK files using Expo CLI
 */

import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  // eslint-disable-next-line no-console -- CLI script needs console output
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  // eslint-disable-next-line no-console -- CLI script needs console output
  console.error(`${colors.red}❌ ${message}${colors.reset}`);
}

function success(message) {
  // eslint-disable-next-line no-console -- CLI script needs console output
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function info(message) {
  // eslint-disable-next-line no-console -- CLI script needs console output
  console.log(`${colors.blue}ℹ️  ${message}${colors.reset}`);
}

function checkExpoCLI() {
  try {
    execSync("npx expo --version", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function checkAndroidSDK() {
  try {
    execSync("npx expo run:android --help", { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function buildAPK(options = {}) {
  const {
    profile = "preview",
    type = "apk",
    outputDir = "./build",
    copyToWeb = true,
  } = options;

  // Validate output directory path
  const resolvedOutputDir = path.resolve(outputDir);
  if (!resolvedOutputDir.startsWith(process.cwd())) {
    throw new Error("Output directory must be within the project directory");
  }

  log(`\n🚀 Starting APK build with profile: ${profile}`, "cyan");
  log(`📱 Build type: ${type}`, "cyan");

  try {
    // Check if Expo CLI is available
    if (!checkExpoCLI()) {
      error("Expo CLI not found. Please install it first.");
      info("Run: npm install -g @expo/cli");
      process.exit(1);
    }

    // Check if Android SDK is available
    if (!checkAndroidSDK()) {
      error("Android SDK not properly configured.");
      info("Please install Android Studio and configure Android SDK.");
      info("Or use EAS Build: npm run eas:build:android:preview");
      process.exit(1);
    }

    // Create output directory (validated path - security check passed)
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path is validated above
    if (!fs.existsSync(resolvedOutputDir)) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Path is validated above
      fs.mkdirSync(resolvedOutputDir, { recursive: true });
    }

    // Build APK using Expo CLI
    log("\n🔨 Building APK...", "yellow");

    let buildCommand;
    if (profile === "development") {
      buildCommand = "npx expo run:android --variant debug";
    } else {
      buildCommand = "npx expo run:android --variant release";
    }

    log(`Running: ${buildCommand}`, "blue");

    execSync(buildCommand, {
      stdio: "inherit",
      cwd: process.cwd(),
    });

    // Find the built APK (validate paths)
    const possibleAPKPaths = [
      path.resolve("./android/app/build/outputs/apk/release/app-release.apk"),
      path.resolve("./android/app/build/outputs/apk/debug/app-debug.apk"),
      path.resolve("./android/app/build/outputs/apk/preview/app-preview.apk"),
    ];

    let apkPath = null;
    for (const apkPathCandidate of possibleAPKPaths) {
      // eslint-disable-next-line security/detect-non-literal-fs-filename -- Paths are hardcoded above
      if (fs.existsSync(apkPathCandidate)) {
        apkPath = apkPathCandidate;
        break;
      }
    }

    if (!apkPath) {
      error("Could not find built APK file.");
      info("Check android/app/build/outputs/apk/ directory");
      process.exit(1);
    }

    // Copy APK to output directory
    const apkFileName = `axon-app-${profile}-${Date.now()}.apk`;
    const outputPath = path.join(resolvedOutputDir, apkFileName);

    fs.copyFileSync(apkPath, outputPath);
    success(`APK built successfully: ${outputPath}`);

    // Copy to web directory if requested
    if (copyToWeb) {
      const webPath = "./web/axon-app.apk";
      fs.copyFileSync(outputPath, webPath);
      success(`APK copied to web directory: ${webPath}`);
      info(
        "The APK is now available for download at: https://axon-ai.replit.app/axon-app.apk",
      );
    }

    log("\n📋 Build Summary:", "cyan");
    log(`Profile: ${profile}`, "blue");
    log(`Output: ${outputPath}`, "blue");
    log(`Web Access: ${copyToWeb ? "Available" : "Not copied"}`, "blue");

    return outputPath;
  } catch (error) {
    error(`Build failed: ${error.message}`);
    process.exit(1);
  }
}

function showHelp() {
  log("\n📖 APK Build Script Help", "cyan");
  log("Usage: node scripts/build-apk.js [options]", "blue");
  log("\nOptions:", "yellow");
  log(
    "  --profile <profile>    Build profile (development, preview, production)",
    "blue",
  );
  log("  --type <type>         Build type (apk, aab)", "blue");
  log("  --output <dir>        Output directory (default: ./build)", "blue");
  log("  --no-web-copy         Don't copy APK to web directory", "blue");
  log("  --help                Show this help message", "blue");
  log("\nExamples:", "yellow");
  log("  node scripts/build-apk.js --profile preview", "blue");
  log(
    "  node scripts/build-apk.js --profile development --output ./downloads",
    "blue",
  );
  log("  node scripts/build-apk.js --profile production --no-web-copy", "blue");
}

// Main execution
const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFilePath) {
  const args = process.argv.slice(2);

  if (args.includes("--help")) {
    showHelp();
    process.exit(0);
  }

  const options = {
    profile: "preview",
    type: "apk",
    outputDir: "./build",
    copyToWeb: true,
  };

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--profile":
        options.profile = args[++i];
        break;
      case "--type":
        options.type = args[++i];
        break;
      case "--output":
        options.outputDir = args[++i];
        break;
      case "--no-web-copy":
        options.copyToWeb = false;
        break;
    }
  }

  buildAPK(options);
}

export { buildAPK };
