import { createTamagui } from "tamagui";
import { config } from "@tamagui/config/v3";

// Custom theme tokens for JSRVIS
const jsrvisTokens = {
  ...config.tokens,
  color: {
    ...config.tokens.color,
    // Primary brand colors
    primary: "#6366F1",
    primaryLight: "#818CF8",
    primaryDark: "#4F46E5",
    // Backgrounds
    backgroundRoot: "#0A0E1A",
    backgroundDefault: "#111827",
    backgroundSecondary: "#1F2937",
    // Text
    text: "#F9FAFB",
    textSecondary: "#9CA3AF",
    textTertiary: "#6B7280",
    // Borders
    border: "#374151",
    borderLight: "#4B5563",
    // Status colors
    success: "#10B981",
    error: "#EF4444",
    warning: "#F59E0B",
  },
};

export const tamaguiConfig = createTamagui({
  ...config,
  tokens: jsrvisTokens,
  themes: {
    ...config.themes,
    dark: {
      ...config.themes.dark,
      background: jsrvisTokens.color.backgroundRoot,
      backgroundHover: jsrvisTokens.color.backgroundSecondary,
      backgroundPress: jsrvisTokens.color.backgroundDefault,
      backgroundFocus: jsrvisTokens.color.backgroundSecondary,
      color: jsrvisTokens.color.text,
      colorHover: jsrvisTokens.color.text,
      colorPress: jsrvisTokens.color.textSecondary,
      colorFocus: jsrvisTokens.color.text,
      borderColor: jsrvisTokens.color.border,
      borderColorHover: jsrvisTokens.color.borderLight,
      borderColorPress: jsrvisTokens.color.primary,
      borderColorFocus: jsrvisTokens.color.primary,
    },
    light: {
      ...config.themes.light,
      background: "#FFFFFF",
      backgroundHover: "#F3F4F6",
      backgroundPress: "#E5E7EB",
      backgroundFocus: "#F3F4F6",
      color: "#111827",
      colorHover: "#111827",
      colorPress: "#374151",
      colorFocus: "#111827",
      borderColor: "#E5E7EB",
      borderColorHover: "#D1D5DB",
      borderColorPress: jsrvisTokens.color.primary,
      borderColorFocus: jsrvisTokens.color.primary,
    },
  },
});

export default tamaguiConfig;

export type TamaguiConfig = typeof tamaguiConfig;

declare module "tamagui" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface TamaguiCustomConfig extends TamaguiConfig {}
}
