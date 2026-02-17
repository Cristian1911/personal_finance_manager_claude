"use client";

import * as React from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Category, CategoryWithChildren, TransactionDirection } from "@/types/domain";

interface CategoryComboboxProps {
  categories: CategoryWithChildren[];
  value: string | null;
  onValueChange: (id: string | null) => void;
  direction?: TransactionDirection;
  placeholder?: string;
  triggerClassName?: string;
  /** Render a hidden input for form submission */
  name?: string;
}

export function CategoryCombobox({
  categories,
  value,
  onValueChange,
  direction,
  placeholder = "Sin categoría",
  triggerClassName,
  name,
}: CategoryComboboxProps) {
  const [open, setOpen] = React.useState(false);

  // Filter tree by direction (keep roots that match or have no direction)
  const filtered = direction
    ? categories.filter((c) => !c.direction || c.direction === direction)
    : categories;

  // Separate grouped roots (with children) from standalone leaves
  const groups = filtered.filter((c) => c.children.length > 0);
  const standalone = filtered.filter((c) => c.children.length === 0);

  // Find the selected leaf across all groups and standalone
  const allLeaves = [
    ...groups.flatMap((g) => g.children),
    ...standalone,
  ];
  const selected = allLeaves.find((c) => c.id === value);

  function handleSelect(id: string | null) {
    onValueChange(id);
    setOpen(false);
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "justify-between font-normal",
              !selected && "text-muted-foreground",
              triggerClassName
            )}
          >
            {selected ? (
              <span className="flex items-center gap-2 truncate">
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: selected.color }}
                />
                <span className="truncate">
                  {selected.name_es ?? selected.name}
                </span>
              </span>
            ) : (
              <span className="truncate">{placeholder}</span>
            )}
            <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar categoría..." />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>

              {/* "None" option */}
              <CommandGroup>
                <CommandItem
                  value="__none__"
                  onSelect={() => handleSelect(null)}
                >
                  <X className="mr-2 h-3.5 w-3.5 opacity-50" />
                  Sin categoría
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      value === null ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              </CommandGroup>

              {/* Grouped categories: parent name as heading, children as items */}
              {groups.map((group) => (
                <CommandGroup
                  key={group.id}
                  heading={group.name_es ?? group.name}
                >
                  {group.children.map((child) => (
                    <CategoryItem
                      key={child.id}
                      category={child}
                      isSelected={value === child.id}
                      onSelect={() => handleSelect(child.id)}
                    />
                  ))}
                </CommandGroup>
              ))}

              {/* Standalone categories (no parent, no children — e.g. "Otros Gastos") */}
              {standalone.length > 0 && (
                <CommandGroup heading="Otros">
                  {standalone.map((cat) => (
                    <CategoryItem
                      key={cat.id}
                      category={cat}
                      isSelected={value === cat.id}
                      onSelect={() => handleSelect(cat.id)}
                    />
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}

function CategoryItem({
  category,
  isSelected,
  onSelect,
}: {
  category: Category;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      value={category.name_es ?? category.name}
      onSelect={onSelect}
    >
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: category.color }}
      />
      {category.name_es ?? category.name}
      <Check
        className={cn(
          "ml-auto h-4 w-4",
          isSelected ? "opacity-100" : "opacity-0"
        )}
      />
    </CommandItem>
  );
}
