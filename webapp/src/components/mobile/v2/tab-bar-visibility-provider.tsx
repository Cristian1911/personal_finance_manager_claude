"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

interface TabBarVisibilityValue {
  /**
   * True when at least one consumer has requested the bar to be hidden.
   * The MobileTabBar reads this in addition to its own pathname/keyboard
   * checks.
   */
  isHidden: boolean;
  /**
   * Imperative setter — prefer `useHideTabBar()` for declarative usage.
   * Multiple callers are reference-counted: the bar stays hidden as long as
   * any caller has set hidden=true.
   */
  setHidden: (hidden: boolean) => void;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityValue>({
  isHidden: false,
  setHidden: () => {},
});

export function TabBarVisibilityProvider({ children }: { children: React.ReactNode }) {
  // Reference count — supports multiple simultaneous hide requests (e.g. an
  // import wizard step + a nested overlay both want focus mode).
  const [hideCount, setHideCount] = useState(0);

  const setHidden = useCallback((hidden: boolean) => {
    setHideCount((prev) => Math.max(0, prev + (hidden ? 1 : -1)));
  }, []);

  const value = useMemo(
    () => ({ isHidden: hideCount > 0, setHidden }),
    [hideCount, setHidden],
  );

  return (
    <TabBarVisibilityContext.Provider value={value}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
}

export function useTabBarVisibility() {
  return useContext(TabBarVisibilityContext);
}

/**
 * Declarative helper — hides the tab bar while the calling component is
 * mounted and the `active` flag is true. Call from any client component
 * inside the dashboard layout.
 *
 * @example
 *   useHideTabBar(); // hides while mounted
 *
 * @example
 *   useHideTabBar(step !== "upload"); // hides only on certain steps
 */
export function useHideTabBar(active: boolean = true) {
  const { setHidden } = useTabBarVisibility();
  useEffect(() => {
    if (!active) return;
    setHidden(true);
    return () => setHidden(false);
  }, [active, setHidden]);
}
