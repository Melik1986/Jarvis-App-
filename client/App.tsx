import React, { useEffect, useState } from "react";
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

function AppContent() {
  const themeMode = useSettingsStore((state) => state.theme);
  const systemColorScheme = useColorScheme();
  const isDark =
    themeMode === "system"
      ? systemColorScheme === "dark"
      : themeMode === "dark";

  const language = useSettingsStore((state) => state.language);

  useEffect(() => {
    if (language === "system") {
      const deviceLanguage = getLocales()[0].languageCode;
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
        >
          <RootStackNavigator />
        </NavigationContainer>
        <GlobalLoader />
        <StatusBar style={isDark ? "light" : "dark"} />
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      try {
        await new Promise((resolve) => setTimeout(resolve, 100));
      } finally {
        setAppIsReady(true);
        await SplashScreen.hideAsync().catch(() => {});
      }
    }
    prepare();
  }, []);

  if (!appIsReady) {
    return null;
  }

  return (
    <React.StrictMode>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <AppContent />
          </SafeAreaProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </React.StrictMode>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
