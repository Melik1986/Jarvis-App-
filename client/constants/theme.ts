import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#1A1A2E",
    textSecondary: "#4A4A5A",
    textTertiary: "#7A7A8A",
    buttonText: "#FFFFFF",
    tabIconDefault: "#7A7A8A",
    tabIconSelected: "#0066CC",
    link: "#0066CC",
    primary: "#0066CC",
    primaryDark: "#004499",
    accent: "#7C4DFF",
    success: "#00A65A",
    error: "#DC3545",
    warning: "#F39C12",
    backgroundRoot: "#F5F7FA",
    backgroundDefault: "#FFFFFF",
    backgroundSecondary: "#EBEEF2",
    backgroundTertiary: "#DDE2E8",
    glow: "rgba(0, 102, 204, 0.2)",
    border: "rgba(0, 0, 0, 0.1)",
  },
  dark: {
    text: "#FFFFFF",
    textSecondary: "#A0AABF",
    textTertiary: "#6B7589",
    buttonText: "#0A0E1A",
    tabIconDefault: "#6B7589",
    tabIconSelected: "#00D9FF",
    link: "#00D9FF",
    primary: "#00D9FF",
    primaryDark: "#00A3BF",
    accent: "#7C4DFF",
    success: "#00E676",
    error: "#FF5252",
    warning: "#FFB74D",
    backgroundRoot: "#0A0E1A",
    backgroundDefault: "#151B2E",
    backgroundSecondary: "#1F2637",
    backgroundTertiary: "#2A3142",
    glow: "rgba(0, 217, 255, 0.3)",
    border: "rgba(0, 217, 255, 0.2)",
  },
};

export type ThemeColors = typeof Colors.light;

export type ThemeMode = "light" | "dark" | "system";

export const getColors = (mode: ThemeMode) => {
  if (mode === "system") {
    // This is a fallback, actual system theme is handled via hooks
    return Colors.light;
  }
  return Colors[mode];
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 48,
  buttonHeight: 52,
  fabSize: 64,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  "2xl": 40,
  "3xl": 50,
  full: 9999,
};

export const Typography = {
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
};

export const Shadows = {
  glow: {
    shadowColor: "#00D9FF",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fab: {
    shadowColor: "#00D9FF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded:
      "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
