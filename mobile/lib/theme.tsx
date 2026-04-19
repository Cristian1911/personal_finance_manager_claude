import * as SecureStore from "expo-secure-store";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ThemeMode = "sage" | "neutral";

const THEME_KEY = "zeta.theme-mode";
const DEFAULT_THEME: ThemeMode = "sage";

type ThemeContextValue = {
  mode: ThemeMode;
  setMode: (next: ThemeMode) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: DEFAULT_THEME,
  setMode: () => {},
});

export function ZetaThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_THEME);

  useEffect(() => {
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(THEME_KEY);
        if (stored === "sage" || stored === "neutral") {
          setModeState(stored);
        }
      } catch {
        // non-fatal — fall back to default
      }
    })();
  }, []);

  const setMode = useCallback(async (next: ThemeMode) => {
    setModeState(next);
    try {
      await SecureStore.setItemAsync(THEME_KEY, next);
    } catch {
      // non-fatal
    }
  }, []);

  const value = useMemo(() => ({ mode, setMode }), [mode, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}

/**
 * Resolve theme-aware surface classes.
 * Swap these usages anywhere a surface needs to respect the user's choice.
 */
export function themeSurfaceClasses(mode: ThemeMode) {
  const isNeutral = mode === "neutral";
  return {
    ink: isNeutral ? "bg-z-ink-neutral" : "bg-z-ink",
    surface1: isNeutral ? "bg-z-surface-neutral" : "bg-z-surface",
    surface2: isNeutral ? "bg-z-surface-2-neutral" : "bg-z-surface-2",
    surface3: isNeutral ? "bg-z-surface-3-neutral" : "bg-z-surface-3",
  };
}
