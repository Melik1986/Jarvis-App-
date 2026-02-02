import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import LoginScreen from "@/screens/LoginScreen";
import LLMProviderScreen from "@/screens/LLMProviderScreen";
import ERPSettingsScreen from "@/screens/ERPSettingsScreen";
import RAGSettingsScreen from "@/screens/RAGSettingsScreen";
import LanguageScreen from "@/screens/LanguageScreen";
import VoiceScreen from "@/screens/VoiceScreen";
import HelpScreen from "@/screens/HelpScreen";
import PrivacyScreen from "@/screens/PrivacyScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useAuthStore } from "@/store/authStore";
import { useTranslation } from "@/hooks/useTranslation";

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  LLMProvider: undefined;
  ERPSettings: undefined;
  RAGSettings: undefined;
  Language: undefined;
  Voice: undefined;
  Help: undefined;
  Privacy: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const { t } = useTranslation();
  const screenOptions = useScreenOptions();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!isAuthenticated ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
      ) : (
        <>
          <Stack.Screen
            name="Main"
            component={MainTabNavigator}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="LLMProvider"
            component={LLMProviderScreen}
            options={{
              presentation: "modal",
              headerTitle: t("provider"),
            }}
          />
          <Stack.Screen
            name="ERPSettings"
            component={ERPSettingsScreen}
            options={{
              presentation: "modal",
              headerTitle: t("provider"),
            }}
          />
          <Stack.Screen
            name="RAGSettings"
            component={RAGSettingsScreen}
            options={{
              presentation: "modal",
              headerTitle: t("settings"),
            }}
          />
          <Stack.Screen
            name="Language"
            component={LanguageScreen}
            options={{
              presentation: "modal",
              headerTitle: t("language"),
            }}
          />
          <Stack.Screen
            name="Voice"
            component={VoiceScreen}
            options={{
              presentation: "modal",
              headerTitle: t("theme"),
            }}
          />
          <Stack.Screen
            name="Help"
            component={HelpScreen}
            options={{
              presentation: "modal",
              headerTitle: t("helpSupport"),
            }}
          />
          <Stack.Screen
            name="Privacy"
            component={PrivacyScreen}
            options={{
              presentation: "modal",
              headerTitle: t("privacyPolicy"),
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}
