"use client";

import { Plus } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  MOBILE_TAB_BAR_CLEARANCE_CLASS,
  PANEL_INSET_SUBTLE_CLASS,
} from "@/lib/constants/styles";
import { WIDGET_CATALOG, type WidgetType } from "@/lib/dashboard/widgets";

interface AddWidgetSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (type: WidgetType) => void;
  existingTypes: Set<WidgetType>;
}

export function AddWidgetSheet({
  open,
  onOpenChange,
  onAdd,
  existingTypes,
}: AddWidgetSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className={cn(
          "max-h-[85dvh] overflow-y-auto rounded-t-2xl border-t border-white/6 bg-z-surface-2",
          MOBILE_TAB_BAR_CLEARANCE_CLASS,
        )}
      >
        <SheetHeader className="gap-1 border-b border-white/6 pb-3">
          <SheetTitle className="text-sm">Añadir widget</SheetTitle>
          <SheetDescription className="text-[11px] text-muted-foreground">
            Elige qué quieres ver en tu inicio. Puedes quitarlo o moverlo después.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-2 px-4 pt-3 pb-1">
          {WIDGET_CATALOG.filter((entry) => entry.type !== "pulse").map((entry) => {
            const already = existingTypes.has(entry.type);
            const disabled = !entry.available || already;
            return (
              <button
                key={entry.type}
                type="button"
                onClick={() => {
                  if (disabled) return;
                  onAdd(entry.type);
                  onOpenChange(false);
                }}
                disabled={disabled}
                className={cn(
                  PANEL_INSET_SUBTLE_CLASS,
                  "flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors",
                  disabled ? "opacity-50" : "active:bg-white/[0.04]",
                )}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-foreground">
                    {entry.label}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {entry.description}
                  </p>
                </div>
                {already ? (
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    En inicio
                  </span>
                ) : !entry.available ? (
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    Próximamente
                  </span>
                ) : (
                  <Plus className="size-4 shrink-0 text-z-brass" aria-hidden />
                )}
              </button>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
