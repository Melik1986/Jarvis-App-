import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { getLocales } from "expo-localization";
import {
  NavigationContainer,
  DarkTheme,
  DefaultTheme,
} from "@react-navigation/native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";

import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/query-client";

import RootStackNavigator from "@/navigation/RootStackNavigator";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { GlobalLoader } from "@/components/GlobalLoader";
import { Colors } from "@/constants/theme";
import { useSettingsStore } from "@/store/settingsStore";

SplashScreen.preventAutoHideAsync().catch(() => {});
SplashScreen.setOptions({
  duration: 300,
  fade: true,
});

const MIN_SPLASH_VISIBLE_MS = 1000;
const BOOT_OVERLAY_VISIBLE_MS = 1200;

const customDarkTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: Colors.dark.primary,
    background: Colors.dark.backgroundRoot,
    card: Colors.dark.backgroundRoot,
    text: Colors.dark.text,
    border: Colors.dark.border,
    notification: Colors.dark.primary,
  },
};

const customLightTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.light.primary,
    background: Colors.light.backgroundRoot,
    card: Colors.light.backgroundRoot,
    text: Colors.light.text,
    border: Colors.light.border,
    notification: Colors.light.primary,
  },
};

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [navigationReady, setNavigationReady] = useState(false);
  const [bootOverlayVisible, setBootOverlayVisible] = useState(true);
  const splashStartTsRef = useRef<number>(Date.now());
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bootOverlayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    async function prepare() {
      setAppIsReady(true);
    }
    void prepare();
  }, []);

  useEffect(() => {
    if (!appIsReady || !navigationReady) return;
    const elapsedMs = Date.now() - splashStartTsRef.current;
    const remainingMs = Math.max(0, MIN_SPLASH_VISIBLE_MS - elapsedMs);

    hideTimeoutRef.current = setTimeout(() => {
      void SplashScreen.hideAsync().catch(() => {});
      bootOverlayTimeoutRef.current = setTimeout(() => {
        setBootOverlayVisible(false);
      }, BOOT_OVERLAY_VISIBLE_MS);
    }, remainingMs);

    return () => {
      if (hideTimeoutRef.current !== null) {
        clearTimeout(hideTimeoutRef.current);
      }
      if (bootOverlayTimeoutRef.current !== null) {
        clearTimeout(bootOverlayTimeoutRef.current);
      }
    };
  }, [appIsReady, navigationReady]);

  if (!appIsReady) {
    return null;
  }

  const content = (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <AppContentWithReady
            onReady={() => setNavigationReady(true)}
            bootOverlayVisible={bootOverlayVisible}
          />
        </SafeAreaProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );

  const shouldUseStrictMode = typeof __DEV__ !== "undefined" ? !__DEV__ : true;

  return shouldUseStrictMode ? (
    <React.StrictMode>{content}</React.StrictMode>
  ) : (
    content
  );
}

function AppContentWithReady({
  onReady,
  bootOverlayVisible,
}: {
  onReady: () => void;
  bootOverlayVisible: boolean;
}) {
  const themeMode = useSettingsStore((state) => state.theme);
  const systemColorScheme = useColorScheme();
  const isDark =
    themeMode === "system"
      ? systemColorScheme === "dark"
      : themeMode === "dark";

  const language = useSettingsStore((state) => state.language);

  useEffect(() => {
    if (language === "system") {
      const deviceLanguage = getLocales()[0]?.languageCode;
      if (deviceLanguage) {
        // Just use the code for now (e.g., 'en', 'ru')
      }
    }
  }, [language]);

  return (
    <GestureHandlerRootView
      style={[
        styles.root,
        {
          backgroundColor: isDark
            ? Colors.dark.backgroundRoot
            : Colors.light.backgroundRoot,
        },
      ]}
    >
      <KeyboardProvider>
        <NavigationContainer
          theme={isDark ? customDarkTheme : customLightTheme}
          onReady={onReady}
        >
          <RootStackNavigator />
        </NavigationContainer>
        <GlobalLoader forceVisible={bootOverlayVisible} />
        <StatusBar style={isDark ? "light" : "dark"} />
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
