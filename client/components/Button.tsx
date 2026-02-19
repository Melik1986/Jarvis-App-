import React, { ReactNode } from "react";
import { StyleSheet, Pressable, ViewStyle, StyleProp } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  WithSpringConfig,
} from "react-native-reanimated";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing } from "@/constants/theme";

interface ButtonProps {
  onPress?: () => void;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "outline";
}

const springConfig: WithSpringConfig = {
  damping: 15,
  mass: 0.3,
  stiffness: 150,
  overshootClamping: true,
};

function applySpring(
  sv: { value: number },
  toValue: number,
  config: WithSpringConfig,
) {
  sv.value = withSpring(toValue, config);
}

export function Button({
  onPress,
  children,
  style,
  disabled = false,
  variant = "primary",
}: ButtonProps) {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      applySpring(scale, 0.95, springConfig);
    }
  };

  const handlePressOut = () => {
    if (!disabled) {
      applySpring(scale, 1, springConfig);
    }
  };

  const getBackgroundColor = () => {
    if (disabled) return theme.textTertiary;
    switch (variant) {
      case "secondary":
        return theme.backgroundSecondary;
      case "outline":
        return "transparent";
      default:
        return theme.primary;
    }
  };

  const getTextColor = () => {
    switch (variant) {
      case "secondary":
        return theme.text;
      case "outline":
        return theme.primary;
      default:
        return theme.buttonText;
    }
  };

  return (
    <Animated.View
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          opacity: disabled ? 0.5 : 1,
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor: theme.primary,
        },
        style,
        animatedStyle,
      ]}
    >
      <Pressable
        onPress={disabled ? undefined : onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={styles.pressable}
      >
        <ThemedText
          type="body"
          style={[styles.buttonText, { color: getTextColor() }]}
        >
          {children}
        </ThemedText>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["2xl"],
  },
  pressable: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontWeight: "600",
  },
});
