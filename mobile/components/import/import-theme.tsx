import { useTheme } from "../../lib/theme";

/**
 * Back-compat shim — import screens originally had their own context.
 * Now delegates to the global theme so the Settings toggle can drive it.
 */
export function useImportTheme(): { neutral: boolean } {
  const { mode } = useTheme();
  return { neutral: mode === "neutral" };
}

/**
 * No-op provider kept so existing screen wrappers don't break during the
 * migration. The global ZetaThemeProvider in _layout is the real source.
 */
export function ImportThemeProvider({
  children,
}: {
  neutral?: boolean;
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

export function themeClasses(neutral: boolean) {
  return {
    ink: neutral ? "bg-z-ink-neutral" : "bg-z-ink",
    surface1: neutral ? "bg-z-surface-neutral" : "bg-z-surface",
    surface2: neutral ? "bg-z-surface-2-neutral" : "bg-z-surface-2",
    surface3: neutral ? "bg-z-surface-3-neutral" : "bg-z-surface-3",
  };
}
