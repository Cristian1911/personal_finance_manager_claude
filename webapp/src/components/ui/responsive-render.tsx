"use client";

import type { ReactNode } from "react";
import { useMediaQuery } from "@/hooks/use-media-query";

/**
 * Only renders children on viewports >= the lg breakpoint (1024px).
 * Prevents heavy desktop components from mounting on mobile.
 */
export function DesktopOnly({ children }: { children: ReactNode }) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  if (!isDesktop) return null;
  return <>{children}</>;
}
