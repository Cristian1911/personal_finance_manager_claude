"use client";

import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
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
  SECTION_EYEBROW_CLASS,
} from "@/lib/constants/styles";
import {
  WIDGET_CATALOG,
  type WidgetInstance,
  type WidgetSize,
} from "@/lib/dashboard/widgets";

const SIZE_LABEL: Record<WidgetSize, string> = {
  XS: "Pequeño (1/3)",
  S: "Mediano (1/2)",
  M: "Mediano (1/2)",
  L: "Grande (completo)",
};

/** Sizes offered for user selection. M is reserved internally, not picked by users. */
const PICKABLE_SIZES: WidgetSize[] = ["XS", "S", "L"];

interface WidgetEditSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  widget: WidgetInstance | null;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onResize: (size: WidgetSize) => void;
  onRemove: () => void;
}

const ROW_CLASS = cn(
  PANEL_INSET_SUBTLE_CLASS,
  "flex w-full items-center gap-3 px-3 py-3 text-left text-sm transition-colors active:bg-white/[0.04] disabled:opacity-40",
);
const ROW_ICON_CLASS =
  "inline-flex size-8 items-center justify-center rounded-lg bg-white/[0.04] text-muted-foreground";

export function WidgetEditSheet({
  open,
  onOpenChange,
  widget,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onResize,
  onRemove,
}: WidgetEditSheetProps) {
  if (!widget) return null;
  const entry = WIDGET_CATALOG.find((c) => c.type === widget.type);
  const label = entry?.label ?? widget.type;

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
          <SheetTitle className="text-sm">{label}</SheetTitle>
          <SheetDescription className="text-[11px] text-muted-foreground">
            Mueve, cambia el tamaño o quita este widget.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-4 pt-4 pb-2">
          {/* Move */}
          <section>
            <p className={cn(SECTION_EYEBROW_CLASS, "mb-2")}>
              Posición
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onMoveUp}
                disabled={!canMoveUp}
                className={ROW_CLASS}
              >
                <span className={ROW_ICON_CLASS}>
                  <ArrowUp className="size-4" />
                </span>
                <span className="flex-1">Mover arriba</span>
              </button>
              <button
                type="button"
                onClick={onMoveDown}
                disabled={!canMoveDown}
                className={ROW_CLASS}
              >
                <span className={ROW_ICON_CLASS}>
                  <ArrowDown className="size-4" />
                </span>
                <span className="flex-1">Mover abajo</span>
              </button>
            </div>
          </section>

          {/* Size */}
          <section>
            <p className={cn(SECTION_EYEBROW_CLASS, "mb-2")}>
              Tamaño
            </p>
            <div className="grid grid-cols-3 gap-2">
              {PICKABLE_SIZES.map((size) => {
                const selected = widget.size === size;
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => onResize(size)}
                    className={cn(
                      PANEL_INSET_SUBTLE_CLASS,
                      "flex flex-col items-center gap-0.5 px-2 py-3 text-center transition-colors",
                      selected
                        ? "border-z-brass/40 bg-z-brass/10"
                        : "active:bg-white/[0.04]",
                    )}
                  >
                    <span
                      className={cn(
                        "text-[13px] font-bold",
                        selected ? "text-z-brass" : "text-foreground",
                      )}
                    >
                      {size}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {SIZE_LABEL[size]}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Remove */}
          <section>
            <button
              type="button"
              onClick={onRemove}
              className={cn(ROW_CLASS, "text-z-debt")}
            >
              <span
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-lg bg-z-debt/10 text-z-debt",
                )}
              >
                <Trash2 className="size-4" />
              </span>
              <span className="flex-1">Quitar widget</span>
            </button>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
