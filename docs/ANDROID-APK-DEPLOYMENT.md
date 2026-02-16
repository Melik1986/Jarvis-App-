# Android APK Deployment Guide for AXON App

## Overview

This guide provides comprehensive instructions for building, deploying, and distributing Android APK files for the AXON Voice-to-ERP AI Orchestrator app.

## Current Status

- ✅ Web interface updated with APK download button
- ✅ EAS Build configuration enhanced with multiple profiles
- ✅ Build scripts created for automated APK generation
- ✅ APK hosting strategy implemented for Replit deployment
- ⚠️ APK file needs to be built and deployed to web directory

## Build Configuration

### EAS Build Profiles (eas.json)

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleDebug"
      }
    },
    "preview": {
      "android": {
        "buildType": "apk",
        "distribution": "internal",
        "gradleCommand": ":app:assembleRelease"
      }
    },
    "production": {
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleRelease"
      }
    }
  }
}
```

### Build Scripts (package.json)

```json
{
  "scripts": {
    "build:android": "npx expo run:android --variant release",
    "build:android:debug": "npx expo run:android --variant debug",
    "build:apk": "npx expo build:android --type apk",
    "build:apk:preview": "npx expo build:android --type apk --profile preview",
    "eas:build:android": "npx eas build --platform android",
    "eas:build:android:preview": "npx eas build --platform android --profile preview"
  }
}
```

## APK Build Methods

### Method 1: Local Development Build (Recommended for Testing)

```bash
# Install dependencies
npm install

# Build debug APK for testing
npm run build:android:debug

# Build release APK
npm run build:android
```

### Method 2: EAS Cloud Build (Recommended for Production)

```bash
# Install EAS CLI (if not available)
npm install -g @expo/cli

# Login to Expo account
npx expo login

# Build preview APK (internal distribution)
npm run eas:build:android:preview

# Build production APK
npm run eas:build:android
```

### Method 3: Custom Build Script

```bash
# Use the custom build script
node scripts/build-apk.js --profile preview

# Build with custom options
node scripts/build-apk.js --profile production --output ./downloads --no-web-copy
```

## APK Distribution Strategy

### 1. Web-Based Download (Current Implementation)

- APK file hosted at: `https://axon-ai.replit.app/axon-app.apk`
- Download button added to web interface
- Fallback instructions for manual build

### 2. Direct APK Hosting

- APK files stored in `/web/` directory for web access
- Automatic copying during build process
- Versioned APK files with timestamps

### 3. Alternative Distribution Methods

#### Google Play Store (Future)

```bash
# Build App Bundle for Play Store
npm run build:aab

# Upload to Play Console
# Requires Google Play Developer account ($25 one-time fee)
```

#### Firebase App Distribution

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Deploy to Firebase App Distribution
firebase appdistribution:distribute build/axon-app.apk --app <app-id>
```

#### Internal Distribution

```bash
# Use EAS internal distribution
eas build --platform android --profile preview --non-interactive
```

## Web Interface Integration

### Download Button Implementation

The web interface (`web/index.html`) now includes:

- Android APK download button with material design icon
- JavaScript function to check APK availability
- Fallback instructions for manual build
- Updated notice text mentioning Android availability

### JavaScript Functions

```javascript
function downloadAPK() {
  const apkUrl = "/axon-app.apk";

  fetch(apkUrl, { method: "HEAD" })
    .then((response) => {
      if (response.ok) {
        window.location.href = apkUrl;
      } else {
        showBuildInstructions();
      }
    })
    .catch(() => showBuildInstructions());
}

function showBuildInstructions() {
  alert(
    "APK file is not available yet. Please build it using one of these methods:\n\n" +
      "1. Use Expo CLI: npm run build:android\n" +
      "2. Use EAS Build: eas build --platform android --profile preview\n" +
      "3. Contact support for pre-built APK",
  );
}
```

## Deployment Steps

### Step 1: Build APK

Choose one of the build methods above and generate the APK file.

### Step 2: Copy to Web Directory

```bash
# After successful build, copy APK to web directory
cp android/app/build/outputs/apk/release/app-release.apk web/axon-app.apk
```

### Step 3: Verify Web Access

- Visit `https://axon-ai.replit.app/`
- Click "Download APK for Android" button
- Verify APK downloads successfully

### Step 4: Test Installation

- Download APK on Android device
- Enable "Unknown Sources" in device settings
- Install APK and verify app functionality

## Troubleshooting

### Common Issues

#### 1. "eas command not found"

```bash
# Use npx instead of eas directly
npx eas build --platform android --profile preview

# Or install EAS CLI globally
npm install -g @expo/cli
```

#### 2. Android SDK not configured

```bash
# Install Android Studio
# Configure Android SDK path
# Set ANDROID_HOME environment variable
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
```

#### 3. Build fails with memory issues

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"

# Use release build instead of debug
npm run build:android
```

#### 4. APK not found after build

```bash
# Check build output directory
ls -la android/app/build/outputs/apk/

# Look for app-release.apk or app-debug.apk
```

### Build Verification

```bash
# Check APK signature
apksigner verify --verbose android/app/build/outputs/apk/release/app-release.apk

# Check APK information
aapt dump badging android/app/build/outputs/apk/release/app-release.apk
```

## Security Considerations

### APK Signing

- Development builds use debug keystore
- Production builds require proper signing certificate
- Consider using Play App Signing for production

### Distribution Security

- Host APK over HTTPS only
- Implement APK integrity verification
- Consider using app bundle signing for additional security

## Next Steps

### Immediate Actions

1. Build APK using one of the provided methods
2. Copy APK to web directory
3. Test download and installation
4. Verify app functionality on Android device

### Future Improvements

1. Set up automated CI/CD pipeline for APK builds
2. Implement version management for APK files
3. Add APK integrity verification
4. Consider Google Play Store submission
5. Implement Firebase App Distribution for beta testing

### Monitoring

- Track APK download statistics
- Monitor installation success rates
- Collect user feedback on Android version
- Monitor app performance on different Android versions

## Support

For issues with APK building or deployment:

1. Check build logs in terminal
2. Verify Android SDK configuration
3. Test on multiple Android devices
4. Review Expo documentation for latest build requirements
5. Consider using EAS Build for cloud-based builds

## Resources

- [Expo Android Build Documentation](https://docs.expo.dev/build/setup/)
- [Android APK Signing Guide](https://developer.android.com/studio/publish/app-signing)
- [EAS Build Configuration](https://docs.expo.dev/build/eas-json/)
- [React Native Android Setup](https://reactnative.dev/docs/environment-setup)
