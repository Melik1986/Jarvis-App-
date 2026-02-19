import React, { useEffect, useMemo } from "react";
import { View, StyleSheet, useWindowDimensions } from "react-native";
import LottieView, { type AnimationObject } from "lottie-react-native";
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";

import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";

export type AgentState = "idle" | "listening" | "speaking";

interface AgentVisualizerProps {
  state: AgentState;
  volume?: number;
  size?: number;
  color?: string;
}

const baseAnimation =
  require("@/assets/lottie/agent-ring.json") as AnimationObject;

function hexToRgb01(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function recolorLottie(
  source: AnimationObject,
  primaryHex: string,
  accentHex: string,
): AnimationObject {
  const primary = hexToRgb01(primaryHex);
  const accent = hexToRgb01(accentHex);

  const clone = JSON.parse(JSON.stringify(source)) as unknown;

  const isRecord = (value: unknown): value is Record<string, unknown> => {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  };

  const mapColor = (rgba: unknown) => {
    if (!Array.isArray(rgba) || rgba.length !== 4) return rgba;
    const [r, g, b, a] = rgba;
    if (
      typeof r !== "number" ||
      typeof g !== "number" ||
      typeof b !== "number" ||
      typeof a !== "number"
    ) {
      return rgba;
    }

    const t = Math.min(1, Math.max(0, (r + g + b) / 3));
    const nr = lerp(primary[0], accent[0], t);
    const ng = lerp(primary[1], accent[1], t);
    const nb = lerp(primary[2], accent[2], t);

    return [nr, ng, nb, a];
  };

  const recolorProp = (prop: unknown) => {
    if (!isRecord(prop)) return;

    const a = prop.a;
    if (typeof a === "number" && a === 0) {
      prop.k = mapColor(prop.k);
      return;
    }

    if (typeof a === "number" && a === 1 && Array.isArray(prop.k)) {
      for (const kf of prop.k) {
        if (!isRecord(kf)) continue;
        if (Array.isArray(kf.s)) kf.s = mapColor(kf.s);
        if (Array.isArray(kf.e)) kf.e = mapColor(kf.e);
      }
    }
  };

  const walk = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }

    if (!isRecord(node)) return;

    if (node.c) recolorProp(node.c);
    if (node.sc) recolorProp(node.sc);

    for (const value of Object.values(node)) {
      walk(value);
    }
  };

  walk(clone);
  return clone as AnimationObject;
}

function startPulseAnimation(target: { value: number }, state: AgentState) {
  const intensity = state === "idle" ? 0.5 : state === "listening" ? 0.9 : 1.1;
  target.value = withRepeat(
    withSequence(
      withTiming(1, {
        duration: 1200 / intensity,
        easing: Easing.inOut(Easing.quad),
      }),
      withTiming(0, {
        duration: 1200 / intensity,
        easing: Easing.inOut(Easing.quad),
      }),
    ),
    -1,
    true,
  );
}

export const AgentVisualizer: React.FC<AgentVisualizerProps> = ({
  state,
  volume = 0,
  size,
  color,
}) => {
  const { width } = useWindowDimensions();
  const fallbackSize = Math.max(Spacing.fabSize, Math.round(width * 0.4));
  const s = size ?? fallbackSize;

  const { theme } = useTheme();
  const primaryColor = color ?? theme.primary;
  const accentColor = theme.accent;

  const animation = useMemo(() => {
    return recolorLottie(baseAnimation, primaryColor, accentColor);
  }, [accentColor, primaryColor]);

  const smoothVolume = useDerivedValue(() => {
    return withSpring(volume, { damping: 16, stiffness: 120 });
  }, [volume]);

  const pulse = useSharedValue(0);

  useEffect(() => {
    startPulseAnimation(pulse, state);
  }, [pulse, state]);

  const animatedStyle = useAnimatedStyle(() => {
    const v = smoothVolume.value;
    const base = state === "idle" ? 0.96 : 1;
    const scale = base + interpolate(pulse.value, [0, 1], [0, 0.05]) + v * 0.05;
    return {
      transform: [{ scale }],
    };
  }, [state]);

  const speed = useMemo(() => {
    if (state === "idle") return 0.75;
    if (state === "listening") return 1.05 + volume * 0.65;
    return 1.2 + volume * 0.9;
  }, [state, volume]);

  return (
    <View style={[styles.container, { width: s, height: s }]}>
      <Animated.View style={[styles.animWrapper, animatedStyle]}>
        <LottieView
          key={`${primaryColor}-${accentColor}`}
          source={animation}
          autoPlay
          loop
          speed={speed}
          style={{ width: s, height: s, backgroundColor: "transparent" }}
        />
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  animWrapper: {
    backgroundColor: "transparent",
  },
});
