"use client";

import { useState, useCallback, useEffect } from "react";
import { Plus, ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type FabAction = "expense" | "income" | "transfer";

interface FabMenuProps {
  onAction: (action: FabAction) => void;
}

const SUB_ACTIONS: {
  id: FabAction;
  label: string;
  icon: typeof ArrowUpRight;
  bg: string;
}[] = [
  { id: "expense", label: "Gasto rápido", icon: ArrowUpRight, bg: "bg-orange-500" },
  { id: "income", label: "Ingreso", icon: ArrowDownLeft, bg: "bg-green-500" },
  { id: "transfer", label: "Transferencia", icon: ArrowLeftRight, bg: "bg-blue-500" },
];

export function FabMenu({ onAction }: FabMenuProps) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handleAction = useCallback(
    (action: FabAction) => {
      setOpen(false);
      onAction(action);
    },
    [onAction],
  );

  return (
    <div className="lg:hidden">
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sub-actions */}
      {open && (
        <div
          className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-3 pb-[env(safe-area-inset-bottom)]"
        >
          {SUB_ACTIONS.map((action, index) => (
            <button
              key={action.id}
              type="button"
              aria-label={action.label}
              onClick={() => handleAction(action.id)}
              className={cn(
                "flex items-center gap-3 animate-in slide-in-from-bottom-2 fade-in fill-mode-both",
              )}
              style={{
                animationDelay: `${index * 60}ms`,
                animationDuration: "200ms",
              }}
            >
              <span className="rounded-full bg-black/70 px-3 py-1.5 text-sm font-medium text-white">
                {action.label}
              </span>
              <span
                className={cn(
                  "flex size-10 items-center justify-center rounded-full text-white shadow-lg",
                  action.bg,
                )}
              >
                <action.icon className="size-5" strokeWidth={2} />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Main FAB */}
      <button
        type="button"
        onClick={toggle}
        className={cn(
          "fixed bottom-5 left-1/2 z-50 flex size-14 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform duration-200 mb-[env(safe-area-inset-bottom)]",
          open && "rotate-45",
        )}
        aria-label={open ? "Cerrar menú" : "Abrir menú de acciones"}
      >
        <Plus className="size-7" strokeWidth={2.5} />
      </button>
    </div>
  );
}
