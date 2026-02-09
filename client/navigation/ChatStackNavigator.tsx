import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ChatScreen from "@/screens/ChatScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type ChatStackParamList = {
  Chat: { conversationId?: string } | undefined;
};

const Stack = createNativeStackNavigator<ChatStackParamList>();

export default function ChatStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          headerTitle: () => <HeaderTitle title="AXON" />,
        }}
      />
    </Stack.Navigator>
  );
}
