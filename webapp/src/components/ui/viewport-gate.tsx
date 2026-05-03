"use client";

import { useEffect, useState } from "react";

/**
 * Renders children only when the media query matches. SSR + first client
 * render always pass through (so server output and hydration match), then
 * after mount the gate evaluates the real viewport and unmounts when it
 * doesn't match. Used to keep recharts/heavy trees out of the off-viewport
 * branch instead of relying on `display:none` (which triggers spurious
 * "width(0) height(0)" warnings from ResponsiveContainer).
 *
 * Pass a `className` (e.g. `"lg:hidden"` or `"hidden lg:block"`) so the
 * off-viewport branch is hidden via CSS during the initial paint and
 * hydration window — avoids a flash where both branches are visible
 * before the post-hydration effect runs.
 */
export function ViewportGate({
  query,
  children,
  className,
}: {
  query: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setShow(mql.matches);
    const handler = (e: MediaQueryListEvent) => setShow(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  if (!show) return null;
  if (className) return <div className={className}>{children}</div>;
  return <>{children}</>;
}
