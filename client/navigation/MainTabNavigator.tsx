import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet } from "react-native";

import ChatStackNavigator from "@/navigation/ChatStackNavigator";
import LibraryStackNavigator from "@/navigation/LibraryStackNavigator";
import HistoryStackNavigator from "@/navigation/HistoryStackNavigator";
import ProfileStackNavigator from "@/navigation/ProfileStackNavigator";
import {
  AnimatedChatIcon,
  AnimatedChatFilledIcon,
  AnimatedLibraryIcon,
  AnimatedLibraryFilledIcon,
  AnimatedHistoryIcon,
  AnimatedHistoryFilledIcon,
  AnimatedProfileIcon,
  AnimatedProfileFilledIcon,
} from "@/components/AnimatedIcons";
import { Colors } from "@/constants/theme";
import { useTranslation } from "@/hooks/useTranslation";

export type MainTabParamList = {
  ChatTab: undefined;
  LibraryTab: undefined;
  HistoryTab: undefined;
  ProfileTab: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabNavigator() {
  const { t } = useTranslation();

  return (
    <Tab.Navigator
      initialRouteName="ChatTab"
      screenOptions={{
        tabBarActiveTintColor: Colors.dark.tabIconSelected,
        tabBarInactiveTintColor: Colors.dark.tabIconDefault,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: Platform.select({
            ios: "transparent",
            android: Colors.dark.backgroundRoot,
            web: Colors.dark.backgroundRoot,
          }),
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === "ios" ? (
            <BlurView
              intensity={100}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="ChatTab"
        component={ChatStackNavigator}
        options={{
          title: t("chat"),
          tabBarIcon: ({ color, size, focused }) =>
            focused ? (
              <AnimatedChatFilledIcon size={size} color={color} />
            ) : (
              <AnimatedChatIcon size={size} color={color} />
            ),
        }}
      />
      <Tab.Screen
        name="LibraryTab"
        component={LibraryStackNavigator}
        options={{
          title: t("library"),
          tabBarIcon: ({ color, size, focused }) =>
            focused ? (
              <AnimatedLibraryFilledIcon size={size} color={color} />
            ) : (
              <AnimatedLibraryIcon size={size} color={color} />
            ),
        }}
      />
      <Tab.Screen
        name="HistoryTab"
        component={HistoryStackNavigator}
        options={{
          title: t("history"),
          tabBarIcon: ({ color, size, focused }) =>
            focused ? (
              <AnimatedHistoryFilledIcon size={size} color={color} />
            ) : (
              <AnimatedHistoryIcon size={size} color={color} />
            ),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackNavigator}
        options={{
          title: t("profile"),
          tabBarIcon: ({ color, size, focused }) =>
            focused ? (
              <AnimatedProfileFilledIcon size={size} color={color} />
            ) : (
              <AnimatedProfileIcon size={size} color={color} />
            ),
        }}
      />
    </Tab.Navigator>
  );
}
