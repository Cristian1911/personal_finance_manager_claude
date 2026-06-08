"use client";

import { usePathname } from "next/navigation";
import { isFocusModePath } from "@/lib/constants/mobile-nav";
import { useTabBarVisibility } from "@/components/mobile/v2/tab-bar-visibility-provider";

/**
 * Thin brass accent that pins to the very top of the viewport whenever the
 * mobile tab bar is hidden via focus mode. Acts as the visual cue that the
 * current screen is a single-task surface — without it, the disappearing tab
 * bar reads like a glitch.
 *
 * Mounted once in `(dashboard)/layout.tsx` next to the tab bar.
 */
export function FocusModeAccent() {
  const pathname = usePathname();
  const { isHidden: contextHidden } = useTabBarVisibility();
  const focused = contextHidden || isFocusModePath(pathname);

  if (!focused) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 z-[var(--z-layer-nav)] h-0.5 bg-z-brass lg:hidden"
      style={{ top: "env(safe-area-inset-top)" }}
    />
  );
}
