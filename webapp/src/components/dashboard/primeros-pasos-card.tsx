"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Flag, Check, ChevronDown, ChevronUp, X, Clock } from "lucide-react";

import { cn } from "@/lib/utils";
import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";
import {
  dismissFirstSteps,
  snoozeFirstSteps,
  setFirstStepsCollapsed,
  type FirstStepsData,
} from "@/actions/guided-experience";

/**
 * Guided experience · D2 — "Primeros pasos" Home card.
 * Persistent checklist seeded by the user's purpose; steps auto-complete from
 * real data. Collapsible, dismissible, snoozable (server-persisted). The goal
 * is to unlock the dashboard verdict, not to "complete tasks".
 */
export function PrimerosPasosCard({ data }: { data: FirstStepsData }) {
  const [visible, setVisible] = useState(true);
  const [collapsed, setCollapsed] = useState(data.collapsed);
  const [, startTransition] = useTransition();

  if (!visible) return null;

  const progress = Math.round((data.doneCount / data.total) * 100);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    startTransition(() => {
      void setFirstStepsCollapsed(next);
    });
  }

  function handleDismiss() {
    setVisible(false);
    startTransition(() => {
      void dismissFirstSteps();
    });
  }

  function handleSnooze() {
    setVisible(false);
    startTransition(() => {
      void snoozeFirstSteps();
    });
  }

  return (
    <section className={cn(PANEL_SURFACE_CLASS, "overflow-hidden")}>
      <button
        type="button"
        onClick={toggleCollapsed}
        className="flex w-full items-center gap-3 p-4 text-left"
        aria-expanded={!collapsed}
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-z-brass/30 bg-z-brass/15 text-z-brass">
          <Flag className="size-[18px]" strokeWidth={1.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            Primeros pasos
          </span>
          <span className="block text-[11.5px] text-z-sage-dark">
            Activa Zeta en unos minutos
          </span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-z-brass tabular-nums">
          {data.doneCount} de {data.total}
        </span>
        {collapsed ? (
          <ChevronDown className="size-4 shrink-0 text-z-sage-dark" aria-hidden />
        ) : (
          <ChevronUp className="size-4 shrink-0 text-z-sage-dark" aria-hidden />
        )}
      </button>

      <div className="px-4">
        <div className="h-1 overflow-hidden rounded-full bg-z-surface-3">
          <div
            className="h-full rounded-full bg-z-brass transition-[width] duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {!collapsed && (
        <>
          <ul className="p-2">
            {data.steps.map((step) =>
              step.done ? (
                <li key={step.id} className="flex items-center gap-3 px-2 py-2">
                  <span className="flex size-[22px] shrink-0 items-center justify-center rounded-full bg-z-brass text-z-ink">
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  <span className="text-[13.5px] text-z-sage-dark line-through">
                    {step.label}
                  </span>
                </li>
              ) : (
                <li key={step.id}>
                  <Link
                    href={step.href}
                    className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-white/[0.03]"
                  >
                    <span className="size-[22px] shrink-0 rounded-full border-[1.5px] border-white/15" />
                    <span className="flex-1 text-[13.5px] text-z-sage-light">
                      {step.label}
                    </span>
                    <span className="text-[11px] font-semibold text-z-brass">Ir</span>
                  </Link>
                </li>
              ),
            )}
          </ul>

          <div className="flex items-center gap-5 border-t border-white/6 px-4 py-3">
            <button
              type="button"
              onClick={handleDismiss}
              className="inline-flex items-center gap-1.5 text-xs text-z-sage-dark transition-colors hover:text-z-sage-light"
            >
              <X className="size-3.5" aria-hidden />
              Ocultar por ahora
            </button>
            <button
              type="button"
              onClick={handleSnooze}
              className="inline-flex items-center gap-1.5 text-xs text-z-sage-dark transition-colors hover:text-z-sage-light"
            >
              <Clock className="size-3.5" aria-hidden />
              Recordar mañana
            </button>
          </div>
        </>
      )}
    </section>
  );
}
