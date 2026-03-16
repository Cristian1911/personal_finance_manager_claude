"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  Plus,
  Receipt,
  FileUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

// --- New types ---

export type PrimaryAction = "transaction" | "import-pdf";

export interface ContextAction {
  id: string;
  icon: React.ReactNode;
  label: string;
  description?: string;
}

export interface FabMenuProps {
  onPrimaryAction: (action: PrimaryAction) => void;
  contextActions?: ContextAction[];
  onContextAction?: (id: string) => void;
}

// --- Primary action definitions ---

const PRIMARY_ACTIONS: {
  id: PrimaryAction;
  icon: typeof Receipt;
  label: string;
  description: string;
  bg: string;
}[] = [
  {
    id: "transaction",
    icon: Receipt,
    label: "Transacción",
    description: "Gasto o ingreso",
    bg: "bg-orange-500",
  },
  {
    id: "import-pdf",
    icon: FileUp,
    label: "Importar PDF",
    description: "Extracto bancario",
    bg: "bg-blue-500",
  },
];

export function FabMenu({
  onPrimaryAction,
  contextActions,
  onContextAction,
}: FabMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const toggle = useCallback(() => setOpen((prev) => !prev), []);

  // Close on route change
  useEffect(() => setOpen(false), [pathname]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const handlePrimary = useCallback(
    (action: PrimaryAction) => {
      setOpen(false);
      onPrimaryAction(action);
    },
    [onPrimaryAction],
  );

  const handleContext = useCallback(
    (id: string) => {
      setOpen(false);
      onContextAction?.(id);
    },
    [onContextAction],
  );

  return (
    <div className="lg:hidden">
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Bottom Sheet — sits above the tab bar (h-14 = 3.5rem) */}
      {open && (
        <div
          className={cn(
            "fixed inset-x-0 z-40 rounded-t-2xl bg-background shadow-2xl",
            "animate-in slide-in-from-bottom duration-300",
          )}
          style={{ bottom: "calc(3.5rem + env(safe-area-inset-bottom))" }}
        >
          {/* Drag handle + close button */}
          <div className="flex items-center justify-between px-4 pt-3 pb-2">
            <div className="w-10" />
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
              aria-label="Cerrar menú"
            >
              <Plus className="size-4 rotate-45" strokeWidth={2.5} />
            </button>
          </div>

          <div className="px-4 pb-4">
            {/* Section 1: Acciones rápidas */}
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Acciones rápidas
            </p>
            <div className="grid grid-cols-2 gap-3">
              {PRIMARY_ACTIONS.map((action, index) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handlePrimary(action.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4",
                    "transition-colors active:bg-accent",
                    "animate-in fade-in slide-in-from-bottom-2 fill-mode-both",
                  )}
                  style={{
                    animationDelay: `${index * 40}ms`,
                    animationDuration: "200ms",
                  }}
                >
                  <span
                    className={cn(
                      "flex size-10 items-center justify-center rounded-full text-white",
                      action.bg,
                    )}
                  >
                    <action.icon className="size-5" strokeWidth={2} />
                  </span>
                  <span className="text-sm font-medium">{action.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {action.description}
                  </span>
                </button>
              ))}
            </div>

            {/* Section 2: En esta página */}
            {contextActions && contextActions.length > 0 && (
              <>
                <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  En esta página
                </p>
                <div className="space-y-1">
                  {contextActions.map((action, index) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => handleContext(action.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-3",
                        "transition-colors active:bg-accent",
                        "animate-in fade-in slide-in-from-bottom-1 fill-mode-both",
                      )}
                      style={{
                        animationDelay: `${(PRIMARY_ACTIONS.length + index) * 40}ms`,
                        animationDuration: "200ms",
                      }}
                    >
                      <span className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        {action.icon}
                      </span>
                      <div className="flex flex-col items-start">
                        <span className="text-sm font-medium">
                          {action.label}
                        </span>
                        {action.description && (
                          <span className="text-xs text-muted-foreground">
                            {action.description}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Main FAB — hidden when sheet is open */}
      {!open && (
        <button
          type="button"
          onClick={toggle}
          className="fixed left-1/2 z-50 flex size-14 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg mb-[env(safe-area-inset-bottom)]"
          style={{ bottom: "4.5rem" }}
          aria-label="Abrir menú de acciones"
        >
          <Plus className="size-7" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
