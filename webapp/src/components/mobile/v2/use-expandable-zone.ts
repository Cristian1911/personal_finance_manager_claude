"use client";

import { useState, useCallback } from "react";

/**
 * Accordion-like hook: only one zone can be expanded at a time.
 * Toggling the active zone collapses it; toggling a different zone switches.
 */
export function useExpandableZone<T extends string>(
  initialZone: T | null = null
) {
  const [activeZone, setActiveZone] = useState<T | null>(initialZone);

  const toggle = useCallback((zone: T) => {
    setActiveZone((prev) => (prev === zone ? null : zone));
  }, []);

  const close = useCallback(() => {
    setActiveZone(null);
  }, []);

  const isActive = useCallback(
    (zone: T) => activeZone === zone,
    [activeZone]
  );

  return { activeZone, toggle, close, isActive } as const;
}
