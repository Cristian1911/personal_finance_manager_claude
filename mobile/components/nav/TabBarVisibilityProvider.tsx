import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface TabBarVisibilityValue {
  isHidden: boolean;
  setHidden: (hidden: boolean) => void;
}

const TabBarVisibilityContext = createContext<TabBarVisibilityValue>({
  isHidden: false,
  setHidden: () => {},
});

export function TabBarVisibilityProvider({ children }: { children: ReactNode }) {
  const [hideCount, setHideCount] = useState(0);

  const setHidden = useCallback((hidden: boolean) => {
    setHideCount((prev) => Math.max(0, prev + (hidden ? 1 : -1)));
  }, []);

  const value = useMemo(
    () => ({ isHidden: hideCount > 0, setHidden }),
    [hideCount, setHidden]
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
 * Hides the tab bar while the calling component is mounted and `active` is
 * true. Reference-counted: multiple callers compose cleanly.
 */
export function useHideTabBar(active: boolean = true) {
  const { setHidden } = useTabBarVisibility();
  useEffect(() => {
    if (!active) return;
    setHidden(true);
    return () => setHidden(false);
  }, [active, setHidden]);
}
