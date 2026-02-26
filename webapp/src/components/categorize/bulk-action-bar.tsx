"use client";

import { useState } from "react";
import { X, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryPickerDialog } from "@/components/categorize/category-picker-dialog";
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

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-lg">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Tag className="h-4 w-4 text-primary" />
        <span>
          {selectedCount}{" "}
          {selectedCount === 1 ? "seleccionada" : "seleccionadas"}
        </span>
      </div>

      <div className="h-5 w-px bg-border" />

      <CategoryPickerDialog
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
        triggerClassName="h-8 text-sm w-[240px]"
      />

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0"
        onClick={onClearSelection}
        disabled={isPending}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
