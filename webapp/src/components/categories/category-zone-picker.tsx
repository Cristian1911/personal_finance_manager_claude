"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Search, X, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { trackClientEvent } from "@/lib/utils/analytics";
import {
  zoneBackground,
  zoneBorder,
  zoneTextColor,
  chipBackground,
} from "@/lib/utils/zone-colors";
import { findSuggestion, type CategorySuggestion } from "@/lib/utils/category-suggestion";
import { CategoryIcon } from "./category-icon";
import { InlineCategoryForm, type CreatedCategoryInfo } from "./inline-category-form";
import { ZoneTile } from "./zone-tile";
import type {
  CategoryWithChildren,
  TransactionDirection,
} from "@/types/domain";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CategoryZonePickerProps {
  categories: CategoryWithChildren[];
  value: string | null;
  onValueChange: (id: string | null) => void;
  direction?: TransactionDirection;
  placeholder?: string;
  triggerClassName?: string;
  /** Render a hidden input for form submission */
  name?: string;
  /** Category rules for smart suggestion banner */
  categoryRules?: {
    pattern: string;
    category_id: string;
    match_count: number;
  }[];
  /** Transaction description for smart suggestion lookup */
  transactionDescription?: string;
  /** Presentation variant — auto-detects if omitted */
  variant?: "dialog" | "popover" | "drawer";
  /** External open control — when defined, suppresses internal state. */
  controlledOpen?: boolean;
  onControlledOpenChange?: (open: boolean) => void;
  /** Hide the default trigger button — parent opens via controlledOpen. */
  hideTrigger?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Find the parent zone for a given subcategory id */
function findParentZone(
  categories: CategoryWithChildren[],
  childId: string | null,
): CategoryWithChildren | null {
  if (!childId) return null;
  for (const zone of categories) {
    if (zone.id === childId) return zone;
    if (zone.children.some((c) => c.id === childId)) return zone;
  }
  return null;
}

/** Find a leaf category (subcategory or standalone) by id */
function findLeaf(
  categories: CategoryWithChildren[],
  id: string | null,
): CategoryWithChildren | null {
  if (!id) return null;
  for (const zone of categories) {
    if (zone.id === id && zone.children.length === 0) return zone;
    const child = zone.children.find((c) => c.id === id);
    if (child) return child;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CategoryZonePicker({
  categories,
  value,
  onValueChange,
  direction,
  placeholder = "Elegir categoría",
  triggerClassName,
  name,
  categoryRules,
  transactionDescription,
  variant: variantProp,
  controlledOpen,
  onControlledOpenChange,
  hideTrigger = false,
}: CategoryZonePickerProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpenControlled = controlledOpen !== undefined;
  const open = isOpenControlled ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (isOpenControlled) {
      onControlledOpenChange?.(next);
    } else {
      setInternalOpen(next);
    }
  };
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(
    null,
  );
  // Track locally-created categories so they appear instantly before server re-renders
  const [locallyCreated, setLocallyCreated] = useState<CreatedCategoryInfo[]>([]);
  // Increment on every open to remount PickerBody (resets expandedZone, search, etc.)
  const [sessionId, setSessionId] = useState(0);

  const handleCategoryCreated = useCallback(
    (cat: CreatedCategoryInfo) => {
      setLocallyCreated((prev) => {
        if (prev.some((c) => c.id === cat.id)) return prev;
        return [...prev, cat];
      });
    },
    [],
  );

  const variant = variantProp ?? (isDesktop ? "dialog" : "drawer");

  // Merge locally-created categories into the prop list
  const mergedCategories = useMemo(() => {
    if (locallyCreated.length === 0) return categories;
    // Only add categories whose IDs are not already in the prop
    const existingIds = new Set<string>();
    for (const zone of categories) {
      existingIds.add(zone.id);
      for (const child of zone.children) existingIds.add(child.id);
    }
    const newOnes = locallyCreated.filter((c) => !existingIds.has(c.id));
    if (newOnes.length === 0) return categories;

    const now = new Date().toISOString();
    return categories.map((zone) => {
      const newChildren = newOnes.filter((c) => c.parent_id === zone.id);
      if (newChildren.length === 0) return zone;
      return {
        ...zone,
        children: [
          ...zone.children,
          ...newChildren.map((c): CategoryWithChildren => ({
            id: c.id,
            name: c.name,
            name_es: c.name_es,
            icon: c.icon,
            color: c.color,
            children: [],
            slug: c.name.toLowerCase().replace(/\s+/g, "-"),
            direction: zone.direction,
            parent_id: zone.id,
            is_essential: false,
            is_system: false,
            is_active: true,
            user_id: null,
            created_at: now,
            updated_at: now,
            display_order: zone.children.length,
            expense_type: null,
          })),
        ],
      };
    });
  }, [categories, locallyCreated]);

  // Filter zones by direction
  const filtered = useMemo(
    () =>
      direction
        ? mergedCategories.filter((c) => !c.direction || c.direction === direction)
        : mergedCategories,
    [mergedCategories, direction],
  );

  // Currently selected leaf
  const selected = useMemo(() => findLeaf(filtered, value), [filtered, value]);

  // Parent zone color for the selected chip
  const selectedParent = useMemo(() => findParentZone(filtered, value), [filtered, value]);
  const chipColor = selectedParent?.color ?? selected?.color ?? "#6b7280";

  // Smart suggestion
  const suggestion = useMemo(() => {
    if (!categoryRules || !transactionDescription) return null;
    return findSuggestion(transactionDescription, categoryRules, filtered);
  }, [categoryRules, transactionDescription, filtered]);

  // -----------------------------------------------------------------------
  // Handlers
  // -----------------------------------------------------------------------

  function handleOpen(nextOpen: boolean) {
    if (nextOpen && variant === "popover") {
      setPortalContainer(
        triggerRef.current?.closest(
          "[data-slot='drawer-content']",
        ) as HTMLElement | null,
      );
    }
    if (nextOpen) setSessionId((s) => s + 1);
    setOpen(nextOpen);
    if (nextOpen) {
      void trackClientEvent({
        event_name: "category_picker_opened",
        flow: "categorize",
        step: "zone_picker",
        entry_point: "cta",
        success: true,
      });
    }
  }

  function handleSelect(id: string | null) {
    void trackClientEvent({
      event_name: "category_selected",
      flow: "categorize",
      step: "zone_picker",
      entry_point: "cta",
      success: true,
      metadata: { selected_category_id: id },
    });
    onValueChange(id);
    setOpen(false);
  }

  // -----------------------------------------------------------------------
  // Trigger button — colored chip when selected
  // -----------------------------------------------------------------------

  const triggerButton = (
    <Button
      ref={triggerRef}
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className={cn(
        "justify-between font-normal",
        !selected && "text-muted-foreground",
        triggerClassName,
      )}
      {...(variant !== "popover" ? { onClick: () => handleOpen(true) } : {})}
    >
      {selected ? (
        <span
          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium truncate"
          style={{
            backgroundColor: chipBackground(chipColor),
            color: zoneTextColor(chipColor),
          }}
        >
          <CategoryIcon icon={selected.icon} className="text-[11px] size-3.5" />
          <span className="truncate">
            {selected.name_es ?? selected.name}
          </span>
        </span>
      ) : (
        <span className="truncate">{placeholder}</span>
      )}
      <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
    </Button>
  );

  // -----------------------------------------------------------------------
  // Picker body
  // -----------------------------------------------------------------------

  const pickerContent = (
    <CategoryPickerBody
      key={sessionId}
      categories={filtered}
      value={value}
      onSelect={handleSelect}
      onCategoryCreated={handleCategoryCreated}
      suggestion={suggestion}
      direction={direction}
    />
  );

  // -----------------------------------------------------------------------
  // Render per variant
  // -----------------------------------------------------------------------

  if (variant === "popover") {
    return (
      <>
        {name && <input type="hidden" name={name} value={value ?? ""} />}
        <Popover open={open} onOpenChange={handleOpen}>
          {!hideTrigger && <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>}
          <PopoverContent
            container={portalContainer}
            className="w-[320px] max-w-[min(22rem,calc(100vw-2rem))] p-0 overscroll-contain touch-pan-y"
            align="start"
            side="bottom"
            sideOffset={8}
            collisionPadding={16}
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {pickerContent}
          </PopoverContent>
        </Popover>
      </>
    );
  }

  if (variant === "dialog") {
    return (
      <>
        {name && <input type="hidden" name={name} value={value ?? ""} />}
        {!hideTrigger && triggerButton}
        <Dialog open={open} onOpenChange={handleOpen}>
          <DialogContent className="flex max-h-[70vh] w-full max-w-md flex-col gap-0 overflow-hidden p-0">
            <DialogHeader className="border-b px-4 py-3">
              <DialogTitle>Selecciona una categoría</DialogTitle>
              <DialogDescription>
                Elige la zona y subcategoría que mejor describe este movimiento.
              </DialogDescription>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {pickerContent}
            </div>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // variant === "drawer"
  return (
    <>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      {!hideTrigger && triggerButton}
      <Drawer open={open} onOpenChange={handleOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Elegir categoría</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {pickerContent}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

// ---------------------------------------------------------------------------
// PickerBody — the two-step zone picker content
// ---------------------------------------------------------------------------

export interface CategoryPickerBodyProps {
  categories: CategoryWithChildren[];
  value: string | null;
  onSelect: (id: string | null) => void;
  onCategoryCreated: (cat: CreatedCategoryInfo) => void;
  suggestion: CategorySuggestion | null;
  direction?: TransactionDirection;
}

export function CategoryPickerBody({
  categories,
  value,
  onSelect,
  onCategoryCreated,
  suggestion,
  direction,
}: CategoryPickerBodyProps) {
  const filtered = useMemo(
    () =>
      direction
        ? categories.filter((c) => !c.direction || c.direction === direction)
        : categories,
    [categories, direction],
  );
  const [search, setSearch] = useState("");
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>(() => {
    // Pre-expand zone containing current value
    const parent = findParentZone(filtered, value);
    return parent?.id ?? null;
  });
  const [showInlineCreate, setShowInlineCreate] = useState(false);
  const expandedRowRef = useRef<HTMLDivElement>(null);

  // Auto-scroll expanded zone row to top of scrollable area
  useEffect(() => {
    if (expandedZoneId && expandedRowRef.current) {
      expandedRowRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [expandedZoneId]);

  const query = search.trim().toLowerCase();

  // Zones (parents with children) + standalone categories
  const zones = useMemo(
    () => filtered.filter((c) => c.children.length > 0),
    [filtered],
  );
  const standalone = useMemo(
    () => filtered.filter((c) => c.children.length === 0),
    [filtered],
  );

  // -----------------------------------------------------------------------
  // Search mode — flat filtered list grouped by zone color
  // -----------------------------------------------------------------------

  const searchResults = useMemo(() => {
    if (!query) return null;

    const results: {
      zone: CategoryWithChildren;
      children: CategoryWithChildren[];
    }[] = [];

    for (const zone of zones) {
      const zoneName = (zone.name_es ?? zone.name).toLowerCase();
      const matchingChildren = zone.children.filter((child) => {
        const childName = (child.name_es ?? child.name).toLowerCase();
        return childName.includes(query);
      });

      // If zone name matches, show all its children
      if (zoneName.includes(query)) {
        results.push({ zone, children: zone.children });
      } else if (matchingChildren.length > 0) {
        results.push({ zone, children: matchingChildren });
      }
    }

    // Also search standalone categories
    const matchingStandalone = standalone.filter((cat) =>
      (cat.name_es ?? cat.name).toLowerCase().includes(query),
    );

    return { groups: results, standalone: matchingStandalone };
  }, [query, zones, standalone]);

  const hasSearchResults =
    searchResults &&
    (searchResults.groups.length > 0 || searchResults.standalone.length > 0);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="flex flex-col">
      {/* Smart suggestion banner */}
      {suggestion && !query && (
        <button
          type="button"
          className="flex items-center gap-2 px-4 py-2.5 text-left text-sm transition-colors hover:bg-accent/50 border-b"
          onClick={() => {
            void trackClientEvent({
              event_name: "category_suggestion_accepted",
              flow: "categorize",
              step: "zone_picker",
              entry_point: "suggestion_banner",
              success: true,
              metadata: { category_id: suggestion.categoryId },
            });
            onSelect(suggestion.categoryId);
          }}
        >
          <Sparkles
            className="h-4 w-4 shrink-0"
            style={{ color: suggestion.categoryColor }}
          />
          <span className="flex-1 min-w-0">
            <span
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: chipBackground(suggestion.categoryColor),
                color: zoneTextColor(suggestion.categoryColor),
              }}
            >
              <CategoryIcon icon={suggestion.categoryIcon} className="text-[11px] size-3.5" />
              {suggestion.categoryName}
            </span>
            {suggestion.parentName && (
              <span className="ml-1.5 text-xs text-muted-foreground">
                en {suggestion.parentName}
              </span>
            )}
          </span>
          <span className="text-xs text-muted-foreground shrink-0">
            Sugerida
          </span>
        </button>
      )}

      {/* Search bar */}
      <div className="relative px-3 py-2 border-b">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar o crear categoría..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 h-9 text-sm"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="overflow-y-auto max-h-[min(24rem,50dvh)]">
        {query ? (
          // ----- Search results mode -----
          <div className="p-3 space-y-3">
            {searchResults?.groups.map(({ zone, children }) => (
              <div key={zone.id}>
                <div
                  className="text-xs font-semibold mb-1.5 px-1 flex items-center gap-1.5"
                  style={{ color: zoneTextColor(zone.color) }}
                >
                  <CategoryIcon icon={zone.icon} className="size-3.5" />
                  {zone.name_es ?? zone.name}
                </div>
                <div className="space-y-0.5">
                  {children.map((child) => (
                    <SubcategoryRow
                      key={child.id}
                      category={child}
                      color={zone.color}
                      isSelected={value === child.id}
                      onSelect={() => onSelect(child.id)}
                    />
                  ))}
                </div>
              </div>
            ))}

            {searchResults && searchResults.standalone.length > 0 && (
              <div>
                <div className="text-xs font-semibold mb-1.5 px-1 text-muted-foreground">
                  Otros
                </div>
                <div className="space-y-0.5">
                  {searchResults.standalone.map((cat) => (
                    <SubcategoryRow
                      key={cat.id}
                      category={cat}
                      color={cat.color}
                      isSelected={value === cat.id}
                      onSelect={() => onSelect(cat.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {!hasSearchResults && (
              <div className="text-center py-6 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Sin resultados para &quot;{search}&quot;
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowInlineCreate(true);
                    setSearch("");
                  }}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Crear &quot;{search}&quot;
                </Button>
              </div>
            )}
          </div>
        ) : (
          // ----- Two-step zone picker mode (inline accordion) -----
          <div className="p-3 space-y-3">
            {/* Zone grid — rows of 2 with inline subcategory expansion */}
            <div className="space-y-2">
              {Array.from(
                { length: Math.ceil(zones.length / 2) },
                (_, rowIdx) => {
                  const pair = zones.slice(rowIdx * 2, rowIdx * 2 + 2);
                  const expandedInRow = pair.find(
                    (z) => z.id === expandedZoneId,
                  );
                  return (
                    <div
                      key={rowIdx}
                      ref={pair.some((z) => z.id === expandedZoneId) ? expandedRowRef : undefined}
                    >
                      <div className="grid grid-cols-2 gap-2">
                        {pair.map((zone) => (
                          <ZoneTile
                            key={zone.id}
                            category={zone}
                            showChips={false}
                            isExpanded={expandedZoneId === zone.id}
                            onClick={() =>
                              setExpandedZoneId(
                                expandedZoneId === zone.id ? null : zone.id,
                              )
                            }
                          />
                        ))}
                      </div>
                      {expandedInRow && (
                        <div className="mt-2">
                          <ExpandedSubcategories
                            zones={zones}
                            expandedZoneId={expandedInRow.id}
                            value={value}
                            onSelect={onSelect}
                            onCategoryCreated={onCategoryCreated}
                            direction={direction}
                          />
                        </div>
                      )}
                    </div>
                  );
                },
              )}
            </div>

            {/* Standalone categories (no children) */}
            {standalone.length > 0 && (
              <div className="space-y-0.5">
                {standalone.map((cat) => (
                  <SubcategoryRow
                    key={cat.id}
                    category={cat}
                    color={cat.color}
                    isSelected={value === cat.id}
                    onSelect={() => onSelect(cat.id)}
                  />
                ))}
              </div>
            )}

            {/* Sin categoría */}
            <button
              type="button"
              className={cn(
                "flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-left transition-colors",
                "hover:bg-accent/50",
                value === null && "bg-accent",
              )}
              onClick={() => onSelect(null)}
            >
              <X className="h-3.5 w-3.5 opacity-50" />
              <span className="flex-1">Sin categoría</span>
              {value === null && (
                <Check className="h-4 w-4 text-foreground" />
              )}
            </button>

            {/* Inline create */}
            {showInlineCreate ? (
              <div className="pt-1">
                <InlineCategoryForm
                  direction={direction}
                  onCreated={(cat) => {
                    setShowInlineCreate(false);
                    onCategoryCreated(cat);
                    onSelect(cat.id);
                  }}
                  initialName={search}
                />
              </div>
            ) : (
              <button
                type="button"
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setShowInlineCreate(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Crear nueva categoría...
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ExpandedSubcategories
// ---------------------------------------------------------------------------

function ExpandedSubcategories({
  zones,
  expandedZoneId,
  value,
  onSelect,
  onCategoryCreated,
  direction,
}: {
  zones: CategoryWithChildren[];
  expandedZoneId: string;
  value: string | null;
  onSelect: (id: string | null) => void;
  onCategoryCreated: (cat: CreatedCategoryInfo) => void;
  direction?: TransactionDirection;
}) {
  const zone = zones.find((z) => z.id === expandedZoneId);
  if (!zone || zone.children.length === 0) return null;

  return (
    <div
      className="rounded-xl p-2 space-y-0.5"
      style={{
        backgroundColor: zoneBackground(zone.color),
        borderWidth: "1px",
        borderColor: zoneBorder(zone.color),
      }}
    >
      <div
        className="text-xs font-semibold px-2 py-1 flex items-center gap-1.5"
        style={{ color: zoneTextColor(zone.color) }}
      >
        <CategoryIcon icon={zone.icon} className="size-3.5" />
        {zone.name_es ?? zone.name}
      </div>
      {zone.children.map((child) => (
        <SubcategoryRow
          key={child.id}
          category={child}
          color={zone.color}
          isSelected={value === child.id}
          onSelect={() => onSelect(child.id)}
        />
      ))}
      {/* Inline create within this zone */}
      <div className="pt-1 px-1">
        <InlineCategoryForm
          parentId={zone.id}
          direction={direction}
          parentColor={zone.color}
          parentIcon={zone.icon}
          onCreated={(cat) => {
            onCategoryCreated(cat);
            onSelect(cat.id);
          }}
          placeholder={`Nueva en ${zone.name_es ?? zone.name}...`}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SubcategoryRow — a single subcategory item
// ---------------------------------------------------------------------------

function SubcategoryRow({
  category,
  color,
  isSelected,
  onSelect,
}: {
  category: CategoryWithChildren;
  color: string;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-2 w-full rounded-lg px-3 py-2 text-sm text-left transition-colors",
        "hover:bg-accent/50",
        isSelected && "bg-accent",
      )}
      onClick={onSelect}
    >
      <span
        className="inline-flex items-center justify-center h-6 w-6 rounded-full text-[11px] shrink-0"
        style={{
          backgroundColor: chipBackground(color),
          color: zoneTextColor(color),
        }}
      >
        <CategoryIcon icon={category.icon} className="size-3.5" />
      </span>
      <span className="flex-1 truncate">
        {category.name_es ?? category.name}
      </span>
      {isSelected && <Check className="h-4 w-4 shrink-0 text-foreground" />}
    </button>
  );
}
