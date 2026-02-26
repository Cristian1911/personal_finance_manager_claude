"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Layers2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  Category,
  CategoryWithChildren,
  TransactionDirection,
} from "@/types/domain";

type Section = {
  id: string;
  label: string;
  color?: string | null;
  categories: Category[];
};

interface CategoryPickerDialogProps {
  categories: CategoryWithChildren[];
  value: string | null;
  onValueChange: (id: string | null) => void;
  direction?: TransactionDirection;
  placeholder?: string;
  triggerClassName?: string;
}

export function CategoryPickerDialog({
  categories,
  value,
  onValueChange,
  direction,
  placeholder = "Elegir categoría",
  triggerClassName,
}: CategoryPickerDialogProps) {
  const [open, setOpen] = useState(false);
  const filtered = useMemo(
    () =>
      direction
        ? categories.filter((c) => !c.direction || c.direction === direction)
        : categories,
    [categories, direction]
  );

  const sections = useMemo<Section[]>(() => {
    const grouped = filtered
      .filter((c) => c.children.length > 0)
      .map((group) => ({
        id: group.id,
        label: group.name_es ?? group.name,
        color: group.color,
        categories: group.children,
      }));

    const standalone = filtered.filter((c) => c.children.length === 0);
    if (standalone.length > 0) {
      grouped.push({
        id: "__standalone__",
        label: "Otros",
        color: "",
        categories: standalone,
      });
    }
    return grouped;
  }, [filtered]);

  const selected = useMemo(() => {
    for (const section of sections) {
      const found = section.categories.find((c) => c.id === value);
      if (found) return found;
    }
    return null;
  }, [sections, value]);

  const selectedSectionId = useMemo(() => {
    if (!value) return sections[0]?.id ?? "";
    const section = sections.find((s) =>
      s.categories.some((cat) => cat.id === value)
    );
    return section?.id ?? sections[0]?.id ?? "";
  }, [sections, value]);

  const [activeSectionId, setActiveSectionId] = useState<string>("");

  function handleOpen(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) setActiveSectionId(selectedSectionId);
  }

  const activeSection =
    sections.find((s) => s.id === activeSectionId) ?? sections[0];

  function selectCategory(categoryId: string | null) {
    onValueChange(categoryId);
    setOpen(false);
  }

  return (
    <>
      <Button
        variant="outline"
        className={cn(
          "justify-between font-normal",
          !selected && "text-muted-foreground",
          triggerClassName
        )}
        onClick={() => handleOpen(true)}
      >
        {selected ? (
          <span className="flex items-center gap-2 truncate">
            <span
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: selected.color }}
            />
            <span className="truncate">{selected.name_es ?? selected.name}</span>
          </span>
        ) : (
          <span className="truncate">{placeholder}</span>
        )}
        <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
      </Button>

      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Selecciona una categoría</DialogTitle>
            <DialogDescription>
              Elige primero una sección grande y luego la categoría específica.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-[420px] md:grid-cols-[280px_1fr]">
            <div className="border-r bg-muted/20 p-4">
              <div className="space-y-2">
                {sections.map((section) => {
                  const isActive = section.id === activeSection?.id;
                  return (
                    <button
                      key={section.id}
                      className={cn(
                        "w-full rounded-lg border px-3 py-3 text-left transition-colors",
                        isActive
                          ? "border-primary bg-primary/10"
                          : "bg-background hover:bg-accent/50"
                      )}
                      onClick={() => setActiveSectionId(section.id)}
                    >
                      <div className="flex items-center gap-2">
                        {section.color ? (
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: section.color }}
                          />
                        ) : (
                          <Layers2 className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span className="text-sm font-medium">{section.label}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {section.categories.length} categorías
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {activeSection?.label ?? "Categorías"}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5"
                  onClick={() => selectCategory(null)}
                >
                  <X className="h-3.5 w-3.5" />
                  Sin categoría
                </Button>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {activeSection?.categories.map((category) => {
                  const isSelected = value === category.id;
                  return (
                    <button
                      key={category.id}
                      onClick={() => selectCategory(category.id)}
                      className={cn(
                        "rounded-lg border bg-background px-3 py-3 text-left transition-colors hover:bg-accent/50",
                        isSelected && "border-primary bg-primary/10"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="text-sm font-medium truncate">
                          {category.name_es ?? category.name}
                        </span>
                        {isSelected && (
                          <Check className="ml-auto h-4 w-4 text-primary" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
