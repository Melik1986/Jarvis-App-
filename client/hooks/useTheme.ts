import { useMemo } from "react";
import { useColorScheme } from "react-native";
import { useSettingsStore } from "@/store/settingsStore";
import { Colors } from "@/constants/theme";

export function useTheme() {
  const themeMode = useSettingsStore((state) => state.theme);
  const setTheme = useSettingsStore((state) => state.setTheme);
  const systemColorScheme = useColorScheme();

  const theme = useMemo(() => {
    if (themeMode === "system") {
      return systemColorScheme === "dark" ? Colors.dark : Colors.light;
    }
    return Colors[themeMode];
  }, [themeMode, systemColorScheme]);

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
