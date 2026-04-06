"use client";

import { useState } from "react";
import { Eye, Pencil, PenTool } from "lucide-react";
import { cn } from "@/lib/utils";
import { useReviewMode } from "./use-review-mode";

type DevAction = "inspect" | "annotate" | "sketch" | null;

interface DevFABProps {
  onAction: (action: DevAction) => void;
  activeAction: DevAction;
}

const actions = [
  { id: "inspect" as const, label: "Inspeccionar", icon: Eye },
  { id: "annotate" as const, label: "Anotar Página", icon: Pencil },
  { id: "sketch" as const, label: "Lienzo Libre", icon: PenTool },
];

export function DevFAB({ onAction, activeAction }: DevFABProps) {
  const { enabled } = useReviewMode();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!enabled) return null;

  return (
    <div className="fixed bottom-28 left-4 z-[9999] lg:bottom-6">
      {/* Radial menu */}
      {menuOpen && (
        <div className="absolute bottom-14 left-0 flex flex-col gap-3 lg:gap-2">
          {actions.map((action) => (
            <button
              key={action.id}
              onClick={() => {
                onAction(activeAction === action.id ? null : action.id);
                setMenuOpen(false);
              }}
              className={cn(
                "flex min-h-[44px] items-center gap-2 rounded-full px-4 py-3 text-sm font-medium shadow-lg transition-all lg:min-h-0 lg:px-3 lg:py-2 lg:text-xs",
                activeAction === action.id
                  ? "bg-z-brass text-z-ink"
                  : "bg-z-surface-3 text-z-sage-light border border-white/6 hover:bg-white/5"
              )}
            >
              <action.icon className="size-4" />
              {action.label}
            </button>
          ))}
        </div>
      )}

      {/* Main FAB */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className={cn(
          "flex size-12 items-center justify-center rounded-full shadow-lg transition-all",
          menuOpen || activeAction
            ? "bg-z-brass text-z-ink"
            : "bg-z-surface-3 text-z-sage-light border border-white/6 hover:bg-white/5"
        )}
      >
        <PenTool className="size-5" />
      </button>
    </div>
  );
}
