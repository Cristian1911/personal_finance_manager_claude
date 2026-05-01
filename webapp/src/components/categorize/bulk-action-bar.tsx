"use client";

import { useState } from "react";
import { X, Tag } from "lucide-react";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { Button } from "@/components/ui/button";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import type { CategoryWithChildren } from "@/types/domain";

interface BulkActionBarProps {
  selectedCount: number;
  categories: CategoryWithChildren[];
  onAssign: (categoryId: string) => void;
  onClearSelection: () => void;
  isPending: boolean;
}

export function BulkActionBar({
  selectedCount,
  categories,
  onAssign,
  onClearSelection,
  isPending,
}: BulkActionBarProps) {
  const [value, setValue] = useState<string | null>(null);
  const keyboardInset = useKeyboardInset();

  return (
    <div
      // bottom uses the same calc as MOBILE_TAB_BAR_CLEARANCE_CLASS so this bar
      // sits exactly above the tab bar + FAB overshoot. Safe-area inset is
      // already part of the calc; the inline marginBottom override is gone.
      className="fixed bottom-[calc(var(--z-mobile-tab-bar-h)_+_var(--z-mobile-fab-overshoot)_+_env(safe-area-inset-bottom))] left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg"
      style={{
        bottom: keyboardInset > 0
          ? `${keyboardInset + 12}px`
          : undefined,
      }}
      data-testid="bulk-action-bar"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Tag className="h-4 w-4 text-primary" />
        <span>
          {selectedCount}{" "}
          {selectedCount === 1 ? "seleccionada" : "seleccionadas"}
        </span>
      </div>

      <div className="h-5 w-px bg-border" />

      <CategoryZonePicker
        categories={categories}
        value={value}
        onValueChange={(id) => {
          setValue(id);
          if (id) {
            onAssign(id);
            setValue(null);
          }
        }}
        placeholder="Asignar categoría"
        triggerClassName="h-8 text-sm w-full sm:w-[240px]"
      />

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={onClearSelection}
        disabled={isPending}
        aria-label="Limpiar selección"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </Button>
    </div>
  );
}
