"use client";

import { useState, useEffect, type ReactNode } from "react";

/**
 * Renders children on the server (preserves SSR/streaming for desktop).
 * On the client, unmounts children on mobile viewports (< 1024px)
 * to prevent heavy desktop components from blocking the rendering thread.
 */
export function DesktopOnly({ children }: { children: ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  if (isMobile) return null;
  return <>{children}</>;
}
