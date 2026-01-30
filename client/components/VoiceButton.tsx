import React from "react";
import { StyleSheet, Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  WithSpringConfig,
} from "react-native-reanimated";

import { AnimatedMicIcon, AnimatedStopIcon } from "@/components/AnimatedIcons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";

interface VoiceButtonProps {
  isRecording: boolean;
  onPress: () => void;
  disabled?: boolean;
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function VoiceButton({
  isRecording,
  onPress,
  disabled,
}: VoiceButtonProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);
  const pulseScale = useSharedValue(1);

  React.useEffect(() => {
    if (isRecording) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: 600 }),
          withTiming(1, { duration: 600 }),
        ),
        -1,
        true,
      );
    } else {
      pulseScale.value = withTiming(1, { duration: 200 });
    }
  }, [isRecording, pulseScale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: isRecording ? 0.4 : 0,
  }));

  const handlePressIn = () => {
    if (!disabled) {
      scale.value = withSpring(0.92, springConfig);
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      scale.value = withSpring(1, springConfig);
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View
        style={[styles.pulse, { backgroundColor: theme.primary }, pulseStyle]}
      />
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[
          styles.button,
          animatedStyle,
          disabled && styles.disabled,
          isRecording && { backgroundColor: theme.error + "15" },
        ]}
      >
        {isRecording ? (
          <AnimatedStopIcon size={28} color={theme.error} />
        ) : (
          <AnimatedMicIcon size={28} color={theme.primary} />
        )}
      </AnimatedPressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
  },
  pulse: {
    position: "absolute",
    width: Spacing.fabSize + 24,
    height: Spacing.fabSize + 24,
    borderRadius: (Spacing.fabSize + 24) / 2,
  },
  button: {
    width: Spacing.fabSize,
    height: Spacing.fabSize,
    borderRadius: Spacing.fabSize / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
  },
  disabled: {
    opacity: 0.5,
  },
});
