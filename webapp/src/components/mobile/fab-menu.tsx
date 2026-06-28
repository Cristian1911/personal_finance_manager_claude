"use client";

import { useCallback, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Drawer as DrawerPrimitive } from "vaul";
import { Plus, Mic, Sparkles, Image } from "lucide-react";
import { cn } from "@/lib/utils";
import { MOBILE_SHEET_SAFE_AREA_CLASS } from "@/lib/constants/styles";
import { CoachMark, useCoachMark } from "@/components/guided/coach-mark";

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

/** Modal tier — sits above the tab bar (--z-layer-nav) so the FAB menu's
 * overlay covers the screen. See docs/design-system/Z_INDEX.md. */
const FAB_MENU_Z = "z-[var(--z-layer-modal)]";

export function FabMenu({ open, onOpenChange, onAction, contextActions }: FabMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const closedViaBackRef = useRef(false);
  const fabCoach = useCoachMark("fab-menu");

  // Close on route change
  useEffect(() => {
    closedViaBackRef.current = true;
    onOpenChange(false);
  }, [pathname, onOpenChange]);

  // Back button closes the menu instead of navigating away
  useEffect(() => {
    if (!open) return;
    closedViaBackRef.current = false;
    if (!history.state?.fabMenu) {
      history.pushState({ fabMenu: true }, "");
    }

    function handlePopState() {
      closedViaBackRef.current = true;
      onOpenChange(false);
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (!closedViaBackRef.current) {
        closedViaBackRef.current = true;
        if (history.state?.fabMenu) {
          history.back();
        }
      }
    };
  }, [open, onOpenChange]);

  // Prefetch the transaction page when the menu opens
  useEffect(() => {
    if (open) router.prefetch("/transactions/new");
  }, [open, router]);

  const handleAction = useCallback(
    (action: FabAction) => {
      onOpenChange(false);
      onAction(action);
    },
    [onAction, onOpenChange],
  );

  const handleNewTransaction = useCallback(() => {
    closedViaBackRef.current = true;
    onOpenChange(false);
    router.replace("/transactions/new");
  }, [onOpenChange, router]);

  return (
    <div className="lg:hidden">
      {/* modal={true} gives us: overlay click-to-close, swipe-to-close,
          escape-to-close, focus trapping, body scroll lock — all built-in.
          FAB_MENU_Z (--z-layer-modal) on overlay + content keeps the menu above
          the tab bar (--z-layer-nav) and at the modal tier with other sheets. */}
      <DrawerPrimitive.Root open={open} onOpenChange={onOpenChange}>
        <DrawerPrimitive.Portal>
          <DrawerPrimitive.Overlay
            className={cn("fixed inset-0 bg-black/50", FAB_MENU_Z)}
          />
          <DrawerPrimitive.Content
            data-slot="drawer-content"
            className={cn(
              "fixed inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl border-t bg-background",
              FAB_MENU_Z,
            )}
          >
            <div className="mx-auto mt-3 mb-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
            <DrawerPrimitive.Title className="sr-only">Acciones</DrawerPrimitive.Title>

            <div className={cn("min-h-0 flex-1 overflow-y-auto px-4", MOBILE_SHEET_SAFE_AREA_CLASS)}>
              {fabCoach.show && (
                <CoachMark onDismiss={fabCoach.dismiss} className="mb-4">
                  <b className="font-semibold text-z-white">Más que registrar a mano:</b>{" "}
                  dicta por voz, escribe en una línea o sube un pantallazo de tu banco.
                </CoachMark>
              )}
              {/* Primary: Nueva transacción */}
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

              {/* Image import */}
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
        </DrawerPrimitive.Portal>
      </DrawerPrimitive.Root>
    </div>
  );
}
