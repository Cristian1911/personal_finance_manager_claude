import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import * as SecureStore from "expo-secure-store";
import type { ColorMode, ThemeName } from "../tokens";
import { V2ThemeProvider } from "./ThemeProvider";

export interface ThemePrefs {
  name: ThemeName;
  mode: ColorMode | "system";
}

const KEY = "zeta.v2.theme";
const DEFAULT: ThemePrefs = { name: "oliva", mode: "system" };
const Ctx = createContext<{ prefs: ThemePrefs; setPrefs: (p: ThemePrefs) => void }>({ prefs: DEFAULT, setPrefs: () => undefined });

/** Ajustes › Apariencia (S5-1): Oliva or Nítido, system/light/dark, remembered on this phone. */
export function V2ThemeFromPrefs({ children }: { children: ReactNode }) {
  const [prefs, setState] = useState<ThemePrefs>(DEFAULT);
  useEffect(() => {
    SecureStore.getItemAsync(KEY).then((raw) => {
      if (!raw) return;
      const p = JSON.parse(raw) as Partial<ThemePrefs>;
      if ((p.name === "oliva" || p.name === "nitido") && (p.mode === "system" || p.mode === "light" || p.mode === "dark")) {
        setState({ name: p.name, mode: p.mode });
      }
    }).catch(() => undefined); // a damaged preference just means the default theme
  }, []);
  const setPrefs = (p: ThemePrefs) => {
    setState(p);
    void SecureStore.setItemAsync(KEY, JSON.stringify(p)).catch(() => undefined);
  };
  return (
    <Ctx.Provider value={{ prefs, setPrefs }}>
      <V2ThemeProvider name={prefs.name} mode={prefs.mode}>{children}</V2ThemeProvider>
    </Ctx.Provider>
  );
}

export const useThemePrefs = () => useContext(Ctx);
