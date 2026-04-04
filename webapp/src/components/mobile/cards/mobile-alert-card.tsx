"use client";

import { useState, useMemo, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import type { AttentionSignal } from "@/types/attention";

const STORAGE_KEY = "zeta:dismissed-alert";
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000;

function getTopSignal(signals: AttentionSignal[]): AttentionSignal | null {
  const sorted = [...signals].sort((a, b) => {
    if (a.priority === "action" && b.priority !== "action") return -1;
    if (b.priority === "action" && a.priority !== "action") return 1;
    return b.count - a.count;
  });
  return sorted[0] ?? null;
}

function isDismissed(signal: AttentionSignal): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    const dismissed = JSON.parse(raw) as { key: string; count: number; at: number };
    if (dismissed.key !== signal.key || dismissed.count !== signal.count) return false;
    return Date.now() - dismissed.at < DISMISS_DURATION_MS;
  } catch {
    return false;
  }
}

function dismissSignal(signal: AttentionSignal) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ key: signal.key, count: signal.count, at: Date.now() })
    );
  } catch {}
}

export function MobileAlertCard({ signals }: { signals: AttentionSignal[] }) {
  const signal = useMemo(() => getTopSignal(signals), [signals]);
  const [hidden, setHidden] = useState(() => (signal ? isDismissed(signal) : false));
  const [expanded, setExpanded] = useState(false);

  const handleDismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (signal) {
        dismissSignal(signal);
        setHidden(true);
      }
    },
    [signal]
  );

  if (!signal || hidden) return null;

  const isAction = signal.priority === "action";

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Pill */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[11px] font-semibold transition-colors",
          isAction
            ? "border-z-debt/20 bg-z-debt/8 text-z-debt"
            : "border-z-brass/20 bg-z-brass/8 text-z-brass"
        )}
      >
        <span
          className={cn(
            "h-[5px] w-[5px] rounded-full",
            isAction ? "bg-z-debt" : "bg-z-brass"
          )}
        />
        {signal.count} {signal.label}
        <button
          type="button"
          onClick={handleDismiss}
          className={cn(
            "ml-1 opacity-40 transition-opacity hover:opacity-80",
            isAction ? "text-z-debt" : "text-z-brass"
          )}
          aria-label="Descartar alerta"
        >
          <X className="h-3 w-3" />
        </button>
      </button>

      {/* Expanded dropdown */}
      <div
        className="grid w-full transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div
            className={cn(
              "rounded-xl border p-3 transition-opacity duration-150",
              expanded ? "opacity-100 delay-75" : "opacity-0",
              isAction
                ? "border-z-debt/15 bg-z-debt/5"
                : "border-z-brass/15 bg-z-brass/5"
            )}
          >
            <p className="mb-2.5 text-center text-xs text-muted-foreground">
              {isAction
                ? "Organízalas para que tu presupuesto sea más preciso."
                : "Una sugerencia para mejorar la organización de tus datos."}
            </p>
            <div className="flex gap-2">
              <Link
                href={signal.actionHref}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-colors",
                  isAction
                    ? "border-z-debt/20 bg-z-debt/10 text-z-debt hover:bg-z-debt/15"
                    : "border-z-brass/20 bg-z-brass/10 text-z-brass hover:bg-z-brass/15"
                )}
              >
                {signal.page === "transactions" ? "Categorizar" : "Resolver"} ›
              </Link>
              <button
                type="button"
                onClick={handleDismiss}
                className="flex items-center justify-center rounded-lg border border-white/6 px-3 py-1.5 text-[11px] text-muted-foreground transition-colors hover:bg-white/5"
              >
                Ocultar
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
