import React from "react";
import { StyleSheet, Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";

import { AnimatedMicIcon, AnimatedStopIcon } from "./AnimatedIcons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

interface VoiceButtonProps {
  isRecording: boolean;
  onPress: () => void;
  disabled?: boolean;
  size?: number;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
};

function applySpring(
  sv: { value: number },
  toValue: number,
  config: WithSpringConfig,
) {
  sv.value = withSpring(toValue, config);
}

export function VoiceButton({
  isRecording,
  onPress,
  disabled,
  size = Spacing.fabSize,
}: VoiceButtonProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      applySpring(scale, 0.92, springConfig);
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      applySpring(scale, 1, springConfig);
    }
  };

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Animated.View
        style={[
          styles.button,
          { width: size, height: size, borderRadius: size / 2 },
          animatedStyle,
          disabled && styles.disabled,
          {
            backgroundColor: isRecording ? theme.error : theme.primary,
            shadowColor: isRecording ? theme.error : theme.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          },
        ]}
      >
        <Pressable
          style={styles.pressable}
          onPress={onPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          disabled={disabled}
        >
          {isRecording ? (
            <AnimatedStopIcon size={size * 0.5} color="#fff" />
          ) : (
            <AnimatedMicIcon size={size * 0.5} color="#fff" />
          )}
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  pressable: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  disabled: {
    opacity: 0.5,
  },
});
