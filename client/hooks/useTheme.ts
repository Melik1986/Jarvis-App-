import { useMemo } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import { Colors } from "@/constants/theme";

export function useTheme() {
  const themeMode = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);

  const theme = useMemo(() => Colors[themeMode], [themeMode]);

  const toggleTheme = () => {
    setTheme(themeMode === "dark" ? "light" : "dark");
  };

  return {
    theme,
    themeMode,
    setTheme,
    toggleTheme,
    isDark: themeMode === "dark",
  };
}
