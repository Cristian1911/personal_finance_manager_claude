"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

/**
 * Shared context so all consumers share a single `visualViewport` listener
 * instead of each component attaching its own.
 */
const KeyboardInsetContext = createContext(0);

export function KeyboardInsetProvider({ children }: { children: ReactNode }) {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) return;

    const viewport = window.visualViewport;
    let rafId = 0;

    const sync = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        setInset(
          Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop),
        );
      });
    };

    sync();
    viewport.addEventListener("resize", sync);
    viewport.addEventListener("scroll", sync);

    return () => {
      cancelAnimationFrame(rafId);
      viewport.removeEventListener("resize", sync);
      viewport.removeEventListener("scroll", sync);
    };
  }, []);

  return (
    <KeyboardInsetContext.Provider value={inset}>
      {children}
    </KeyboardInsetContext.Provider>
  );
}

/**
 * Returns the height (in px) of the on-screen virtual keyboard.
 * On desktop or when no keyboard is shown the value is 0.
 *
 * Must be used inside a `<KeyboardInsetProvider>`.
 */
export function useKeyboardInset(): number {
  return useContext(KeyboardInsetContext);
}
