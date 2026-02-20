import React, { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, Modal, StyleSheet, View } from "react-native";
import LottieView, { type AnimationObject } from "lottie-react-native";

import { useLoadingStore } from "@/store/loadingStore";

interface GlobalLoaderProps {
  forceVisible?: boolean;
  forceMessage?: string;
  minVisibleMs?: number;
}

const DEFAULT_MIN_VISIBLE_MS = 650;
const FADE_IN_DURATION_MS = 220;
const FADE_OUT_DURATION_MS = 180;

const loaderAnimation =
  require("@/assets/lottie/agent-ring.json") as AnimationObject;

export function GlobalLoader({
  forceVisible = false,
  minVisibleMs = DEFAULT_MIN_VISIBLE_MS,
}: GlobalLoaderProps) {
  const { isLoading } = useLoadingStore();

  const shouldBeVisible = forceVisible || isLoading;
  const initialVisible = shouldBeVisible;

  const [isRendered, setIsRendered] = useState(initialVisible);
  const fadeAnim = useRef(new Animated.Value(initialVisible ? 1 : 0)).current;
  const shownAtRef = useRef<number | null>(initialVisible ? Date.now() : null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHideTimeout = useCallback(() => {
    if (hideTimeoutRef.current !== null) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (shouldBeVisible) {
      clearHideTimeout();

      if (!isRendered) {
        shownAtRef.current = Date.now();
        setIsRendered(true);
      } else if (shownAtRef.current === null) {
        shownAtRef.current = Date.now();
      }

      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: FADE_IN_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
      return;
    }

    if (!isRendered) return;

    const shownAt = shownAtRef.current ?? Date.now();
    const elapsedMs = Date.now() - shownAt;
    const remainingMs = Math.max(0, minVisibleMs - elapsedMs);

    hideTimeoutRef.current = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: FADE_OUT_DURATION_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (!finished) return;
        shownAtRef.current = null;
        setIsRendered(false);
      });
    }, remainingMs);

    return clearHideTimeout;
  }, [clearHideTimeout, fadeAnim, isRendered, minVisibleMs, shouldBeVisible]);

  useEffect(() => {
    return clearHideTimeout;
  }, [clearHideTimeout]);

  if (!isRendered) {
    return null;
  }

  return (
    <Modal
      transparent
      visible={isRendered}
      animationType="none"
      statusBarTranslucent
    >
      <Animated.View
        pointerEvents="auto"
        style={[
          styles.overlay,
          {
            opacity: fadeAnim,
            backgroundColor: "transparent",
          },
        ]}
      >
        <View style={styles.animationWrap}>
          <LottieView
            source={loaderAnimation}
            autoPlay
            loop
            style={styles.animation}
          />
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 40,
    justifyContent: "center",
    alignItems: "center",
  },
  animationWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  animation: {
    width: 86,
    height: 86,
    backgroundColor: "transparent",
  },
});
