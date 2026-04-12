"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { Plus, ArrowUpRight, ArrowDownLeft, ArrowLeftRight, Mic, Camera, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

export type FabAction = "expense" | "income" | "transfer" | "voice" | "screenshot" | "quick-capture" | "new-recurring" | "new-account";

export interface ContextAction {
  id: FabAction;
  label: string;
  icon: typeof ArrowUpRight;
  bg: string;
}

interface FabMenuProps {
  onAction: (action: FabAction) => void;
  contextActions?: ContextAction[];
}

const SUB_ACTIONS: ContextAction[] = [
  { id: "expense", label: "Gasto rápido", icon: ArrowUpRight, bg: "bg-z-expense" },
  { id: "income", label: "Ingreso", icon: ArrowDownLeft, bg: "bg-z-income" },
  { id: "transfer", label: "Transferencia", icon: ArrowLeftRight, bg: "bg-z-sage-dark" },
];

/**
 * Tracks virtual keyboard height via visualViewport API.
 * Uses transform (GPU-composited) to move the FAB without layout thrashing.
 * Resets synchronously on focusout so the FAB never stays floating.
 */
function useFabKeyboardOffset(ref: React.RefObject<HTMLButtonElement | null>) {
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof window === "undefined" || !window.visualViewport) return;

    const vv = window.visualViewport;

    function getOffset() {
      return Math.max(0, window.innerHeight - vv!.height - vv!.offsetTop);
    }

    let rafId = 0;
    function sync() {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        el!.style.transform = `translate(-50%, -${getOffset()}px)`;
      });
    }

    // Reset immediately when any input loses focus (keyboard closing)
    function onFocusOut() {
      cancelAnimationFrame(rafId);
      el!.style.transform = "translate(-50%, 0px)";
    }

    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    document.addEventListener("focusout", onFocusOut);

    return () => {
      cancelAnimationFrame(rafId);
      vv.removeEventListener("resize", sync);
      vv.removeEventListener("scroll", sync);
      document.removeEventListener("focusout", onFocusOut);
    };
  }, [ref]);
}

export function FabMenu({ onAction, contextActions }: FabMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const fabRef = useRef<HTMLButtonElement>(null);

  useFabKeyboardOffset(fabRef);

  // Close on route change
  useEffect(() => setOpen(false), [pathname]);

  const handleAction = useCallback(
    (action: FabAction) => {
      setOpen(false);
      onAction(action);
    },
    [onAction],
  );

  return (
    <div className="lg:hidden">
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerTitle className="sr-only">Acciones</DrawerTitle>
          <div className="px-4 pb-4">
            {/* Voice capture — prominent */}
            <button
              type="button"
              onClick={() => handleAction("voice")}
              className={cn(
                "mb-4 flex w-full items-center gap-3 rounded-xl border border-z-brass/30 bg-z-brass/10 px-4 py-3",
                "transition-colors active:bg-z-brass/20",
              )}
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-z-brass text-z-ink">
                <Mic className="size-5" strokeWidth={2} />
              </span>
              <div className="text-left">
                <span className="text-sm font-semibold">Captura por voz</span>
                <p className="text-xs text-muted-foreground">
                  Di tu gasto y Zeta lo interpreta
                </p>
              </div>
            </button>

            {/* Capture options */}
            <div className="mb-4 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => handleAction("screenshot")}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/4 px-3 py-3",
                  "transition-colors active:bg-white/8",
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-z-brass/15 text-z-brass">
                  <Camera className="size-4" strokeWidth={2} />
                </span>
                <div className="min-w-0 text-left">
                  <span className="text-xs font-semibold leading-tight">Captura de pantalla</span>
                  <p className="text-[10px] leading-tight text-muted-foreground">
                    Sube un pantallazo
                  </p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleAction("quick-capture")}
                className={cn(
                  "flex items-center gap-2.5 rounded-xl border border-white/8 bg-white/4 px-3 py-3",
                  "transition-colors active:bg-white/8",
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-z-brass/15 text-z-brass">
                  <Sparkles className="size-4" strokeWidth={2} />
                </span>
                <div className="min-w-0 text-left">
                  <span className="text-xs font-semibold leading-tight">Captura rápida</span>
                  <p className="text-[10px] leading-tight text-muted-foreground">
                    Escribe el gasto
                  </p>
                </div>
              </button>
            </div>

            {/* Section 1: Acciones rápidas */}
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Acciones rápidas
            </p>
            <div className="grid grid-cols-3 gap-3">
              {SUB_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleAction(action.id)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-xl border border-border bg-card p-4",
                    "transition-colors active:bg-accent",
                  )}
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
                </button>
              ))}
            </div>

            {/* Section 2: En esta página */}
            {contextActions && contextActions.length > 0 && (
              <>
                <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  En esta página
                </p>
                <div className="space-y-1">
                  {contextActions.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => handleAction(action.id)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-3",
                        "transition-colors active:bg-accent",
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-8 items-center justify-center rounded-full text-white",
                          action.bg,
                        )}
                      >
                        <action.icon className="size-4" strokeWidth={2} />
                      </span>
                      <span className="text-sm font-medium">
                        {action.label}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>

      {/* Main FAB — floats above keyboard via GPU transform, snaps back on close */}
      {!open && (
        <button
          ref={fabRef}
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 left-1/2 z-50 flex size-14 -translate-x-1/2 items-center justify-center rounded-full bg-z-white text-z-ink shadow-lg will-change-transform mb-[env(safe-area-inset-bottom)]"
          aria-label="Abrir menu de acciones"
          data-testid="fab-button"
        >
          <Plus className="size-7" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
