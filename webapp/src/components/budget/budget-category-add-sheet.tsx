"use client";

import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { CategoryIcon } from "@/components/categories/category-icon";
import { MOBILE_SHEET_SAFE_AREA_CLASS } from "@/lib/constants/styles";
import type { CategoryBudgetData } from "@/types/domain";

export interface BudgetCategoryAddSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Heading, e.g. "Agregar a Necesidades". */
  title: string;
  /** Categories available to add (not yet budgeted). */
  categories: CategoryBudgetData[];
  /** Called with the chosen category id; the sheet closes itself. */
  onPick: (categoryId: string) => void;
}

/**
 * Progressive-disclosure category picker for the budget builder. Replaces the
 * always-visible chip wall: "+ Agregar categoría" opens this; picking one
 * activates that category in the builder.
 */
export function BudgetCategoryAddSheet({
  open,
  onOpenChange,
  title,
  categories,
  onPick,
}: BudgetCategoryAddSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{title}</DrawerTitle>
          <DrawerDescription>
            Elige una categoría para presupuestar. Agrega solo las que te importan.
          </DrawerDescription>
        </DrawerHeader>
        <DrawerBody safeArea={false} className={MOBILE_SHEET_SAFE_AREA_CLASS}>
          {categories.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No quedan categorías por agregar.
            </p>
          ) : (
            <div className="space-y-1.5">
              {categories.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    onPick(g.id);
                    onOpenChange(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/6 bg-z-surface-2/60 px-3 py-2.5 text-left transition-colors active:bg-white/5"
                >
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `color-mix(in srgb, ${g.color} 18%, transparent)`, color: g.color }}
                  >
                    <CategoryIcon icon={g.icon} className="size-4" />
                  </span>
                  <span className="text-sm font-medium">{g.name_es ?? g.name}</span>
                </button>
              ))}
            </div>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
}
