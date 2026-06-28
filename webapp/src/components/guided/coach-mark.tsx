"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";
import { getSeenCoachMarks, markCoachMarkSeen } from "@/actions/guided-experience";

/* ──────────────────────────────────────────────────────────────────────────
 * Coach-marks (guided experience · D5)
 * One-time, dismissible ("Entendido"), server-persisted in
 * dashboard_config.guidedExperience.seenCoachMarks. No tour engine.
 * ────────────────────────────────────────────────────────────────────────── */

// Module-level cache so multiple coach-marks on a page share a single fetch.
let seenCache: Set<string> | null = null;
let inflight: Promise<string[]> | null = null;

/**
 * Returns `{ show, dismiss }` for a coach-mark id. `show` is false until the
 * server state has loaded (no flash) and stays false once dismissed/seen.
 */
export function useCoachMark(id: string): { show: boolean; dismiss: () => void } {
  const [, force] = useState(0);

  useEffect(() => {
    if (seenCache) {
      force((n) => n + 1);
      return;
    }
    if (!inflight) inflight = getSeenCoachMarks();
    let active = true;
    inflight.then((list) => {
      seenCache = new Set(list);
      if (active) force((n) => n + 1);
    });
    return () => {
      active = false;
    };
  }, [id]);

  const loaded = seenCache !== null;
  const seen = seenCache?.has(id) ?? false;

  function dismiss() {
    if (!seenCache) seenCache = new Set();
    seenCache.add(id);
    force((n) => n + 1);
    void markCoachMarkSeen(id);
  }

  return { show: loaded && !seen, dismiss };
}

export interface CoachMarkProps {
  children: React.ReactNode;
  onDismiss: () => void;
  /** Pointer arrow position relative to the bubble. */
  pointer?: "up" | "down" | "none";
  /** Horizontal offset of the pointer (CSS left/right value). */
  pointerOffset?: string;
  className?: string;
}

/**
 * Presentational coach-mark bubble: brass-bordered surface, body copy, and an
 * "Entendido" action. Visibility is owned by the caller (via `useCoachMark`).
 */
export function CoachMark({
  children,
  onDismiss,
  pointer = "none",
  pointerOffset = "24px",
  className,
}: CoachMarkProps) {
  return (
    <div
      role="status"
      className={cn(
        "relative rounded-xl border border-z-brass/30 bg-z-surface-3 p-3.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.8)]",
        className,
      )}
    >
      <div className="text-[12.5px] leading-relaxed text-z-sage-light">
        {children}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="mt-2.5 text-xs font-semibold text-z-brass transition-colors hover:text-z-brass-hot"
      >
        Entendido
      </button>
      {pointer !== "none" && (
        <span
          aria-hidden
          className={cn(
            "absolute size-3 rotate-45 border-z-brass/30 bg-z-surface-3",
            pointer === "down"
              ? "-bottom-[6px] border-b border-r"
              : "-top-[6px] border-l border-t",
          )}
          style={pointer === "down" ? { right: pointerOffset } : { left: pointerOffset }}
        />
      )}
    </div>
  );
}
