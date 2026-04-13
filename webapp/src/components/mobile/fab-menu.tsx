"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Drawer as DrawerPrimitive } from "vaul";
import { Plus, Mic, Sparkles, Image } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOBILE_TAB_BAR_CLEARANCE_CLASS } from "@/lib/constants/styles";
import { Drawer, DrawerPortal, DrawerTitle } from "@/components/ui/drawer";

export type FabAction = "voice" | "screenshot" | "quick-capture" | "new-recurring" | "new-account";

export interface ContextAction {
  id: FabAction;
  label: string;
  icon: typeof Plus;
  bg: string;
}

interface FabMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAction: (action: FabAction) => void;
  contextActions?: ContextAction[];
}

export function FabMenu({ open, onOpenChange, onAction, contextActions }: FabMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const closedViaBackRef = useRef(false);

  // Close on route change
  useEffect(() => onOpenChange(false), [pathname, onOpenChange]);

  // Lock body scroll while the non-modal drawer is open
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = prev; };
    }
  }, [open]);

  // Back button closes the menu instead of navigating away
  useEffect(() => {
    if (!open) return;
    closedViaBackRef.current = false;
    history.pushState({ fabMenu: true }, "");

    function handlePopState() {
      closedViaBackRef.current = true;
      onOpenChange(false);
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      // If closed by non-back means (overlay tap, FAB toggle, swipe), pop the dummy entry
      if (!closedViaBackRef.current) {
        history.back();
      }
    };
  }, [open, onOpenChange]);

  // Prefetch the transaction page when the drawer opens
  useEffect(() => {
    if (open) {
      router.prefetch("/transactions/new");
    }
  }, [open, router]);

  const handleAction = useCallback(
    (action: FabAction) => {
      onOpenChange(false);
      onAction(action);
    },
    [onAction, onOpenChange],
  );

  const handleNewTransaction = useCallback(() => {
    onOpenChange(false);
    router.push("/transactions/new");
  }, [onOpenChange, router]);

  return (
    <div className="lg:hidden">
      {/* Custom backdrop — rendered outside vaul so pointer-events are never suppressed */}
      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 transition-opacity"
          onClick={() => onOpenChange(false)}
          aria-hidden="true"
        />
      )}

      {/* modal={false} keeps the tab-bar FAB button interactive so it can toggle close */}
      <Drawer open={open} onOpenChange={onOpenChange} modal={false}>
        <DrawerPortal>
          <DrawerPrimitive.Content
            data-slot="drawer-content"
            className="bg-background fixed inset-x-0 bottom-0 z-50 mt-24 flex max-h-[85dvh] flex-col rounded-t-2xl border-t"
          >
            <div className="mx-auto mt-3 mb-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
            <DrawerTitle className="sr-only">Acciones</DrawerTitle>
            <div className={cn("px-4", MOBILE_TAB_BAR_CLEARANCE_CLASS)}>
              {/* Primary: Nueva transacción — navigates to full page */}
              <button
                type="button"
                onClick={handleNewTransaction}
                className={cn(
                  "mb-4 flex w-full items-center gap-3 rounded-xl border border-z-brass/30 bg-z-brass/10 px-4 py-3",
                  "transition-colors active:bg-z-brass/20",
                )}
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-z-brass text-z-ink">
                  <Plus className="size-5" strokeWidth={2} />
                </span>
                <div className="text-left">
                  <span className="text-sm font-semibold">Nueva transacción</span>
                  <p className="text-xs text-muted-foreground">
                    Gasto, ingreso o transferencia
                  </p>
                </div>
              </button>

              {/* Capture options — voice + quick text */}
              <div className="mb-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleAction("voice")}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border border-white/6 bg-white/4 px-3 py-3",
                    "transition-colors active:bg-white/8",
                  )}
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-z-brass/15 text-z-brass">
                    <Mic className="size-4" strokeWidth={2} />
                  </span>
                  <div className="min-w-0 text-left">
                    <span className="text-xs font-semibold leading-tight">Captura por voz</span>
                    <p className="text-[10px] leading-tight text-muted-foreground">
                      Di tu gasto
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleAction("quick-capture")}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl border border-white/6 bg-white/4 px-3 py-3",
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

              {/* Image import — gallery + camera */}
              <button
                type="button"
                onClick={() => handleAction("screenshot")}
                className={cn(
                  "mb-4 flex w-full items-center gap-2.5 rounded-xl border border-white/6 bg-white/4 px-4 py-3",
                  "transition-colors active:bg-white/8",
                )}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-z-brass/15 text-z-brass">
                  <Image className="size-4" strokeWidth={2} />
                </span>
                <div className="min-w-0 text-left">
                  <span className="text-xs font-semibold leading-tight">Importar pantallazo</span>
                  <p className="text-[10px] leading-tight text-muted-foreground">
                    Sube una imagen de tu app bancaria
                  </p>
                </div>
              </button>

              {/* Context actions — page-specific */}
              {contextActions && contextActions.length > 0 && (
                <>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
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
                            "flex size-8 items-center justify-center rounded-full text-z-white",
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
          </DrawerPrimitive.Content>
        </DrawerPortal>
      </Drawer>
    </div>
  );
}
