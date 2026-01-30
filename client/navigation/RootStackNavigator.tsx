import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import MainTabNavigator from "@/navigation/MainTabNavigator";
import LLMProviderScreen from "@/screens/LLMProviderScreen";
import ERPSettingsScreen from "@/screens/ERPSettingsScreen";
import RAGSettingsScreen from "@/screens/RAGSettingsScreen";
import LanguageScreen from "@/screens/LanguageScreen";
import VoiceScreen from "@/screens/VoiceScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type RootStackParamList = {
  Main: undefined;
  LLMProvider: undefined;
  ERPSettings: undefined;
  RAGSettings: undefined;
  Language: undefined;
  Voice: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
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
          headerTitle: "AI Provider",
        }}
      />
      <Stack.Screen
        name="ERPSettings"
        component={ERPSettingsScreen}
        options={{
          presentation: "modal",
          headerTitle: "ERP Connection",
        }}
      />
      <Stack.Screen
        name="RAGSettings"
        component={RAGSettingsScreen}
        options={{
          presentation: "modal",
          headerTitle: "Knowledge Base",
        }}
      />
      <Stack.Screen
        name="Language"
        component={LanguageScreen}
        options={{
          presentation: "modal",
          headerTitle: "Language",
        }}
      />
      <Stack.Screen
        name="Voice"
        component={VoiceScreen}
        options={{
          presentation: "modal",
          headerTitle: "Voice Settings",
        }}
      />
    </Stack.Navigator>
  );
}
