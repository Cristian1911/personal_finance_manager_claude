import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useColorScheme } from "react-native";
import { getV2Theme, type ColorMode, type ThemeName, type V2Theme } from "../tokens";

const V2ThemeContext = createContext<V2Theme>(getV2Theme("oliva", "light"));

/**
 * Provides the v2 theme. `mode` "system" follows the phone. Ajustes ›
 * Apariencia will store the choice (S5-1); until then callers pass it.
 */
export function V2ThemeProvider({
  name = "oliva",
  mode = "system",
  children,
}: {
  name?: ThemeName;
  mode?: ColorMode | "system";
  children: ReactNode;
}) {
  const system = useColorScheme();
  const resolved: ColorMode = mode === "system" ? (system === "dark" ? "dark" : "light") : mode;
  const theme = useMemo(() => getV2Theme(name, resolved), [name, resolved]);
  return <V2ThemeContext.Provider value={theme}>{children}</V2ThemeContext.Provider>;
}

export function useV2Theme(): V2Theme {
  return useContext(V2ThemeContext);
}
