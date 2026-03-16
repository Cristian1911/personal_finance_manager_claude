"use client";

import { useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Plus, ArrowUpRight, ArrowDownLeft, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";

export type FabAction = "expense" | "income" | "transfer" | "new-recurring" | "new-account";

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
  { id: "expense", label: "Gasto rapido", icon: ArrowUpRight, bg: "bg-orange-500" },
  { id: "income", label: "Ingreso", icon: ArrowDownLeft, bg: "bg-green-500" },
  { id: "transfer", label: "Transferencia", icon: ArrowLeftRight, bg: "bg-blue-500" },
];

export function FabMenu({ onAction, contextActions }: FabMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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
            {/* Section 1: Acciones rapidas */}
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Acciones rapidas
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

            {/* Section 2: En esta pagina */}
            {contextActions && contextActions.length > 0 && (
              <>
                <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  En esta pagina
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

      {/* Main FAB — hidden when drawer is open */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 left-1/2 z-50 flex size-14 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg mb-[env(safe-area-inset-bottom)]"
          aria-label="Abrir menu de acciones"
        >
          <Plus className="size-7" strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
}
