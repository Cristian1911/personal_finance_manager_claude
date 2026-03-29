# Category UX Redesign — Implementation Plan (Wave 1)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the boring text-list category picker and flat management list with a zone-based visual system — two-step zone picker with smart suggestions and inline creation, plus a tile-grid category manager with inline editing.

**Architecture:** New shared primitives (`zone-tile`, `subcategory-chip`, `icon-picker`, `color-picker`) form a visual language. A unified `CategoryZonePicker` replaces both `CategoryPickerDialog` and `CategoryCombobox` across 13 consumer files. A new `CategoryZoneManager` replaces the `CategoryManageList` in the Gestionar tab. All styling derives from existing DB columns (`color`, `icon`, `parent_id`) — no schema changes.

**Tech Stack:** React 19, TypeScript, Tailwind v4, shadcn/ui (Dialog, Drawer, Popover, Command), Framer Motion (expand/collapse), Vitest

**Spec:** `docs/superpowers/specs/2026-03-28-category-ux-redesign.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/utils/zone-colors.ts` | Zone color helpers: tint background, tint border, text color from hex |
| `src/lib/utils/__tests__/zone-colors.test.ts` | Unit tests for color utilities |
| `src/lib/utils/category-suggestion.ts` | Match transaction description against category_rules, return high-confidence suggestion |
| `src/lib/utils/__tests__/category-suggestion.test.ts` | Unit tests for suggestion matching |
| `src/components/categories/subcategory-chip.tsx` | Reusable colored pill for a subcategory |
| `src/components/categories/zone-tile.tsx` | Reusable zone card: icon + name + count + chip cloud |
| `src/components/categories/icon-picker.tsx` | Grid of common emojis for picking category icon |
| `src/components/categories/color-picker.tsx` | Palette of curated colors for picking category color |
| `src/components/categories/inline-category-form.tsx` | Minimal inline form for creating category (name + auto zone assignment) |
| `src/components/categories/category-zone-picker.tsx` | Unified two-step zone picker (replaces CategoryPickerDialog + CategoryCombobox) |
| `src/components/categories/category-zone-manager.tsx` | Zone grid manager with inline editing (replaces CategoryManageList) |

### Modified Files
| File | Change |
|------|--------|
| `src/components/categorize/inbox-transaction-row.tsx` | Swap `CategoryPickerDialog` → `CategoryZonePicker` |
| `src/components/categorize/auto-review-row.tsx` | Swap `CategoryPickerDialog` → `CategoryZonePicker` |
| `src/components/categorize/bulk-action-bar.tsx` | Swap `CategoryPickerDialog` → `CategoryZonePicker` |
| `src/components/transactions/transaction-form.tsx` | Swap `CategoryCombobox` → `CategoryZonePicker` |
| `src/components/transactions/quick-capture-bar.tsx` | Swap `CategoryCombobox` → `CategoryZonePicker` |
| `src/components/transactions/transaction-table.tsx` | Swap `CategoryCombobox` → `CategoryZonePicker` |
| `src/components/recurring/recurring-form.tsx` | Swap `CategoryCombobox` → `CategoryZonePicker` |
| `src/components/destinatarios/destinatario-suggestions-tab.tsx` | Swap `CategoryCombobox` → `CategoryZonePicker` |
| `src/components/dashboard/purchase-decision-card.tsx` | Swap `CategoryCombobox` → `CategoryZonePicker` |
| `src/components/import/parsed-transaction-table.tsx` | Swap `CategoryCombobox` → `CategoryZonePicker` (2 usages) |
| `src/components/import/step-destinatarios.tsx` | Swap `CategoryCombobox` → `CategoryZonePicker` |
| `src/components/mobile/mobile-transaction-form.tsx` | Swap `CategoryCombobox` → `CategoryZonePicker` |
| `src/components/mobile/mobile-presupuesto.tsx` | Swap `CategoryCombobox` → `CategoryZonePicker` |
| `src/app/(dashboard)/categories/page.tsx` | Swap `CategoryManageList` → `CategoryZoneManager` in Gestionar tab |

### Deprecated (delete after Wave 2)
| File | Reason |
|------|--------|
| `src/components/categorize/category-picker-dialog.tsx` | Replaced by `CategoryZonePicker` |
| `src/components/ui/category-combobox.tsx` | Replaced by `CategoryZonePicker` |

---

## Task 1: Zone Color Utilities

**Files:**
- Create: `webapp/src/lib/utils/zone-colors.ts`
- Create: `webapp/src/lib/utils/__tests__/zone-colors.test.ts`

- [ ] **Step 1: Write failing tests for zone color helpers**

```typescript
// webapp/src/lib/utils/__tests__/zone-colors.test.ts
import { describe, it, expect } from "vitest";
import {
  zoneBackground,
  zoneBorder,
  zoneTextColor,
  chipBackground,
} from "../zone-colors";

describe("zoneBackground", () => {
  it("returns hex color at 10% opacity as CSS rgba", () => {
    expect(zoneBackground("#ef4444")).toBe("rgba(239, 68, 68, 0.1)");
  });

  it("handles 3-char hex shorthand", () => {
    expect(zoneBackground("#f00")).toBe("rgba(255, 0, 0, 0.1)");
  });

  it("returns fallback for invalid hex", () => {
    expect(zoneBackground("not-a-color")).toBe("rgba(107, 114, 128, 0.1)");
  });
});

describe("zoneBorder", () => {
  it("returns hex color at 20% opacity", () => {
    expect(zoneBorder("#ef4444")).toBe("rgba(239, 68, 68, 0.2)");
  });
});

describe("chipBackground", () => {
  it("returns hex color at 15% opacity", () => {
    expect(chipBackground("#ef4444")).toBe("rgba(239, 68, 68, 0.15)");
  });
});

describe("zoneTextColor", () => {
  it("returns the original color for dark backgrounds (light text)", () => {
    // Dark theme: category colors are already light-ish, use as-is
    expect(zoneTextColor("#ef4444")).toBe("#ef4444");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd webapp && npx vitest run src/lib/utils/__tests__/zone-colors.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement zone color utilities**

```typescript
// webapp/src/lib/utils/zone-colors.ts

const FALLBACK = { r: 107, g: 114, b: 128 }; // gray-500

function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(/^#([0-9a-f]{3,8})$/i);
  if (!match) return null;
  const h = match[1];
  if (h.length === 3) {
    return { r: parseInt(h[0] + h[0], 16), g: parseInt(h[1] + h[1], 16), b: parseInt(h[2] + h[2], 16) };
  }
  if (h.length >= 6) {
    return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
  }
  return null;
}

function rgba(hex: string, alpha: number): string {
  const c = parseHex(hex) ?? FALLBACK;
  return `rgba(${c.r}, ${c.g}, ${c.b}, ${alpha})`;
}

/** Zone tile background — 10% opacity of zone color */
export function zoneBackground(hex: string): string {
  return rgba(hex, 0.1);
}

/** Zone tile border — 20% opacity of zone color */
export function zoneBorder(hex: string): string {
  return rgba(hex, 0.2);
}

/** Subcategory chip background — 15% opacity of zone color */
export function chipBackground(hex: string): string {
  return rgba(hex, 0.15);
}

/** Zone text color — uses the category color directly (suitable for dark theme) */
export function zoneTextColor(hex: string): string {
  return parseHex(hex) ? hex : `rgb(${FALLBACK.r}, ${FALLBACK.g}, ${FALLBACK.b})`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd webapp && npx vitest run src/lib/utils/__tests__/zone-colors.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
cd webapp && git add src/lib/utils/zone-colors.ts src/lib/utils/__tests__/zone-colors.test.ts
git commit -m "feat(categories): add zone color utilities for tinted backgrounds and borders"
```

---

## Task 2: Category Suggestion Utility

**Files:**
- Create: `webapp/src/lib/utils/category-suggestion.ts`
- Create: `webapp/src/lib/utils/__tests__/category-suggestion.test.ts`

- [ ] **Step 1: Write failing tests for suggestion matching**

```typescript
// webapp/src/lib/utils/__tests__/category-suggestion.test.ts
import { describe, it, expect } from "vitest";
import { findSuggestion } from "../category-suggestion";
import type { CategoryWithChildren } from "@/types/domain";

// Minimal category tree for testing
const categories: CategoryWithChildren[] = [
  {
    id: "parent-1", name: "Gustos", name_es: "Gustos", slug: "gustos",
    icon: "🎯", color: "#f59e0b", direction: "OUTFLOW", parent_id: null,
    is_active: true, is_essential: false, is_system: true, display_order: 0,
    user_id: null, created_at: "", updated_at: "", expense_type: null,
    children: [
      {
        id: "child-1", name: "Restaurants", name_es: "Restaurantes", slug: "restaurantes",
        icon: "🍕", color: "#f59e0b", direction: "OUTFLOW", parent_id: "parent-1",
        is_active: true, is_essential: false, is_system: true, display_order: 0,
        user_id: null, created_at: "", updated_at: "", expense_type: null,
        children: [],
      },
    ],
  },
];

type Rule = { pattern: string; category_id: string; match_count: number };

describe("findSuggestion", () => {
  it("returns suggestion when pattern matches and match_count >= 2", () => {
    const rules: Rule[] = [
      { pattern: "rappi", category_id: "child-1", match_count: 8 },
    ];
    const result = findSuggestion("RAPPI*Restaurante", rules, categories);
    expect(result).not.toBeNull();
    expect(result!.categoryId).toBe("child-1");
    expect(result!.reason).toContain("8");
  });

  it("returns null when match_count < 2 (low confidence)", () => {
    const rules: Rule[] = [
      { pattern: "rappi", category_id: "child-1", match_count: 1 },
    ];
    const result = findSuggestion("RAPPI*Restaurante", rules, categories);
    expect(result).toBeNull();
  });

  it("returns null when no pattern matches", () => {
    const rules: Rule[] = [
      { pattern: "uber", category_id: "child-1", match_count: 5 },
    ];
    const result = findSuggestion("RAPPI*Restaurante", rules, categories);
    expect(result).toBeNull();
  });

  it("returns null for empty description", () => {
    const rules: Rule[] = [
      { pattern: "rappi", category_id: "child-1", match_count: 5 },
    ];
    expect(findSuggestion("", rules, categories)).toBeNull();
  });

  it("returns null when category_id points to inactive category", () => {
    const inactiveCategories: CategoryWithChildren[] = [
      {
        ...categories[0],
        children: [{ ...categories[0].children[0], is_active: false }],
      },
    ];
    const rules: Rule[] = [
      { pattern: "rappi", category_id: "child-1", match_count: 5 },
    ];
    expect(findSuggestion("RAPPI*Restaurante", rules, inactiveCategories)).toBeNull();
  });

  it("picks the highest match_count rule when multiple patterns match", () => {
    const rules: Rule[] = [
      { pattern: "rappi", category_id: "child-1", match_count: 3 },
      { pattern: "rappi*rest", category_id: "child-1", match_count: 10 },
    ];
    const result = findSuggestion("RAPPI*Restaurante", rules, categories);
    expect(result!.reason).toContain("10");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd webapp && npx vitest run src/lib/utils/__tests__/category-suggestion.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement suggestion matching**

```typescript
// webapp/src/lib/utils/category-suggestion.ts
import type { CategoryWithChildren } from "@/types/domain";

type CategoryRule = {
  pattern: string;
  category_id: string;
  match_count: number;
};

export type CategorySuggestion = {
  categoryId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  parentName: string | null;
  reason: string;
};

const MIN_CONFIDENCE = 2;

/**
 * Find a high-confidence category suggestion for a transaction description.
 * Returns null if no rule matches with sufficient confidence.
 */
export function findSuggestion(
  description: string,
  rules: CategoryRule[],
  categories: CategoryWithChildren[]
): CategorySuggestion | null {
  if (!description.trim()) return null;

  const descLower = description.toLowerCase();

  // Find all matching rules, sorted by match_count desc
  const matches = rules
    .filter(
      (r) => r.match_count >= MIN_CONFIDENCE && descLower.includes(r.pattern.toLowerCase())
    )
    .sort((a, b) => b.match_count - a.match_count);

  if (matches.length === 0) return null;

  const best = matches[0];

  // Verify the category exists and is active
  for (const parent of categories) {
    // Check if best.category_id is a parent
    if (parent.id === best.category_id && parent.is_active) {
      return {
        categoryId: parent.id,
        categoryName: parent.name_es ?? parent.name,
        categoryIcon: parent.icon,
        categoryColor: parent.color,
        parentName: null,
        reason: `${best.pattern} aparece ${best.match_count} veces aqui`,
      };
    }
    // Check children
    for (const child of parent.children) {
      if (child.id === best.category_id && child.is_active) {
        return {
          categoryId: child.id,
          categoryName: child.name_es ?? child.name,
          categoryIcon: child.icon,
          categoryColor: child.color,
          parentName: parent.name_es ?? parent.name,
          reason: `${best.pattern} aparece ${best.match_count} veces aqui`,
        };
      }
    }
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd webapp && npx vitest run src/lib/utils/__tests__/category-suggestion.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
cd webapp && git add src/lib/utils/category-suggestion.ts src/lib/utils/__tests__/category-suggestion.test.ts
git commit -m "feat(categories): add high-confidence category suggestion matching"
```

---

## Task 3: SubcategoryChip Component

**Files:**
- Create: `webapp/src/components/categories/subcategory-chip.tsx`

- [ ] **Step 1: Create the subcategory chip component**

```tsx
// webapp/src/components/categories/subcategory-chip.tsx
"use client";

import { cn } from "@/lib/utils";
import { chipBackground, zoneTextColor } from "@/lib/utils/zone-colors";

interface SubcategoryChipProps {
  name: string;
  icon?: string;
  color: string;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function SubcategoryChip({
  name,
  icon,
  color,
  isSelected,
  onClick,
  className,
}: SubcategoryChipProps) {
  const Component = onClick ? "button" : "span";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        onClick && "cursor-pointer hover:opacity-80",
        isSelected && "ring-2 ring-offset-1 ring-offset-background",
        className
      )}
      style={{
        backgroundColor: chipBackground(color),
        color: zoneTextColor(color),
        ...(isSelected ? { ringColor: color } : {}),
      }}
    >
      {icon && <span className="text-[11px]">{icon}</span>}
      <span className="truncate">{name}</span>
    </Component>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd webapp && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to subcategory-chip

- [ ] **Step 3: Commit**

```bash
cd webapp && git add src/components/categories/subcategory-chip.tsx
git commit -m "feat(categories): add SubcategoryChip visual primitive"
```

---

## Task 4: ZoneTile Component

**Files:**
- Create: `webapp/src/components/categories/zone-tile.tsx`

- [ ] **Step 1: Create the zone tile component**

```tsx
// webapp/src/components/categories/zone-tile.tsx
"use client";

import { cn } from "@/lib/utils";
import { zoneBackground, zoneBorder, zoneTextColor } from "@/lib/utils/zone-colors";
import { SubcategoryChip } from "./subcategory-chip";
import type { CategoryWithChildren } from "@/types/domain";

interface ZoneTileProps {
  category: CategoryWithChildren;
  /** When true, renders as a clickable card */
  onClick?: () => void;
  /** Whether this zone is currently expanded/selected */
  isExpanded?: boolean;
  /** Show subcategory chips inside the tile */
  showChips?: boolean;
  /** Optional extra content in the header row (e.g., action buttons) */
  headerActions?: React.ReactNode;
  className?: string;
}

export function ZoneTile({
  category,
  onClick,
  isExpanded,
  showChips = true,
  headerActions,
  className,
}: ZoneTileProps) {
  const color = category.color;
  const name = category.name_es ?? category.name;
  const Component = onClick ? "button" : "div";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "rounded-xl p-3 text-left transition-all w-full",
        onClick && "cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
        isExpanded && "ring-2",
        className
      )}
      style={{
        backgroundColor: zoneBackground(color),
        borderWidth: "1px",
        borderColor: zoneBorder(color),
        ...(isExpanded ? { ringColor: color } : {}),
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{category.icon}</span>
        <span
          className="text-sm font-semibold truncate"
          style={{ color: zoneTextColor(color) }}
        >
          {name}
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {category.children.length}
        </span>
        {headerActions}
      </div>

      {/* Chip cloud */}
      {showChips && category.children.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {category.children.map((child) => (
            <SubcategoryChip
              key={child.id}
              name={child.name_es ?? child.name}
              icon={child.icon}
              color={color}
            />
          ))}
        </div>
      )}
    </Component>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd webapp && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to zone-tile

- [ ] **Step 3: Commit**

```bash
cd webapp && git add src/components/categories/zone-tile.tsx
git commit -m "feat(categories): add ZoneTile visual primitive"
```

---

## Task 5: IconPicker and ColorPicker

**Files:**
- Create: `webapp/src/components/categories/icon-picker.tsx`
- Create: `webapp/src/components/categories/color-picker.tsx`

- [ ] **Step 1: Create the icon picker**

```tsx
// webapp/src/components/categories/icon-picker.tsx
"use client";

import { cn } from "@/lib/utils";

const CATEGORY_ICONS = [
  "🏠", "🍕", "🚌", "💡", "🏥", "🎓", "👶",
  "🎯", "🎬", "🛍️", "✈️", "💪", "🎮", "☕",
  "💰", "📈", "🏦", "💳", "🎁", "📱", "🔧",
  "👗", "🐾", "🌿", "📚", "🎵", "🍺", "🏋️",
  "🚗", "🏡", "💊", "🧹", "👨‍💻", "🎨", "📦",
];

interface IconPickerProps {
  value: string;
  onValueChange: (icon: string) => void;
}

export function IconPicker({ value, onValueChange }: IconPickerProps) {
  return (
    <div className="grid grid-cols-7 gap-1">
      {CATEGORY_ICONS.map((icon) => (
        <button
          key={icon}
          type="button"
          onClick={() => onValueChange(icon)}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg text-lg transition-colors hover:bg-accent",
            value === icon && "bg-accent ring-2 ring-primary"
          )}
        >
          {icon}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create the color picker**

```tsx
// webapp/src/components/categories/color-picker.tsx
"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

const ZONE_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
];

interface ColorPickerProps {
  value: string;
  onValueChange: (color: string) => void;
}

export function ColorPicker({ value, onValueChange }: ColorPickerProps) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {ZONE_COLORS.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onValueChange(color)}
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full transition-transform hover:scale-110",
            value === color && "ring-2 ring-offset-2 ring-offset-background"
          )}
          style={{
            backgroundColor: color,
            ...(value === color ? { ringColor: color } : {}),
          }}
        >
          {value === color && <Check className="h-3.5 w-3.5 text-white" />}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Verify build passes**

Run: `cd webapp && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd webapp && git add src/components/categories/icon-picker.tsx src/components/categories/color-picker.tsx
git commit -m "feat(categories): add IconPicker and ColorPicker for zone editing"
```

---

## Task 6: InlineCategoryForm

**Files:**
- Create: `webapp/src/components/categories/inline-category-form.tsx`

- [ ] **Step 1: Create inline category form**

This component handles inline category creation inside the picker and manager. It calls the existing `createCategory` server action.

```tsx
// webapp/src/components/categories/inline-category-form.tsx
"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createCategory } from "@/actions/categories";
import { toast } from "sonner";
import type { TransactionDirection } from "@/types/domain";

interface InlineCategoryFormProps {
  /** Pre-fill parent_id so the new category goes into the current zone */
  parentId?: string | null;
  /** Inherit direction from parent zone */
  direction?: TransactionDirection | null;
  /** Inherit color from parent zone */
  parentColor?: string;
  /** Inherit icon from parent zone */
  parentIcon?: string;
  /** Called after successful creation with the new category id */
  onCreated?: (categoryId: string) => void;
  /** Initial value for the name field (e.g., from search text) */
  initialName?: string;
  /** Placeholder text */
  placeholder?: string;
}

export function InlineCategoryForm({
  parentId,
  direction,
  parentColor,
  parentIcon,
  onCreated,
  initialName = "",
  placeholder = "Nombre de nueva categoría...",
}: InlineCategoryFormProps) {
  const [name, setName] = useState(initialName);
  const [isPending, startTransition] = useTransition();

  function generateSlug(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 50);
  }

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;

    const formData = new FormData();
    formData.append("name", trimmed);
    formData.append("name_es", trimmed);
    formData.append("slug", generateSlug(trimmed));
    formData.append("icon", parentIcon ?? "tag");
    formData.append("color", parentColor ?? "#6b7280");
    if (parentId) formData.append("parent_id", parentId);
    if (direction) formData.append("direction", direction);
    formData.append("is_essential", "false");

    startTransition(async () => {
      const result = await createCategory(
        { success: false, error: "" },
        formData
      );
      if (result.success) {
        setName("");
        toast.success(`Categoría "${trimmed}" creada`);
        onCreated?.(result.data.id);
      } else {
        toast.error(result.error ?? "Error al crear categoría");
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        placeholder={placeholder}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
        className="h-8 text-sm"
        disabled={isPending}
      />
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={handleSubmit}
        disabled={isPending || !name.trim()}
        className="shrink-0"
      >
        {isPending ? "..." : <Plus className="h-4 w-4" />}
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd webapp && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd webapp && git add src/components/categories/inline-category-form.tsx
git commit -m "feat(categories): add InlineCategoryForm for in-context category creation"
```

---

## Task 7: CategoryZonePicker — Core Component

**Files:**
- Create: `webapp/src/components/categories/category-zone-picker.tsx`

This is the main deliverable — the unified two-step zone picker that replaces both `CategoryPickerDialog` and `CategoryCombobox`.

- [ ] **Step 1: Create the CategoryZonePicker component**

```tsx
// webapp/src/components/categories/category-zone-picker.tsx
"use client";

import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
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
import { findSuggestion } from "@/lib/utils/category-suggestion";
import { InlineCategoryForm } from "./inline-category-form";
import type {
  Category,
  CategoryWithChildren,
  TransactionDirection,
} from "@/types/domain";

type CategoryRule = {
  pattern: string;
  category_id: string;
  match_count: number;
};

interface CategoryZonePickerProps {
  categories: CategoryWithChildren[];
  value: string | null;
  onValueChange: (id: string | null) => void;
  direction?: TransactionDirection;
  placeholder?: string;
  triggerClassName?: string;
  /** For form submission (hidden input) */
  name?: string;
  /** Category rules for smart suggestions */
  categoryRules?: CategoryRule[];
  /** Transaction description for matching */
  transactionDescription?: string;
  /** Force a specific variant instead of auto-detecting */
  variant?: "dialog" | "popover" | "drawer";
}

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
  variant,
}: CategoryZonePickerProps) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // Determine variant
  const resolvedVariant = variant ?? (isDesktop ? "dialog" : "drawer");
  // When used as combobox replacement inline, use popover on desktop
  const isPopover = resolvedVariant === "popover";

  // Filter by direction
  const filtered = useMemo(
    () =>
      direction
        ? categories.filter((c) => !c.direction || c.direction === direction)
        : categories,
    [categories, direction]
  );

  // Zones = parent categories with children
  const zones = useMemo(() => filtered.filter((c) => c.children.length > 0), [filtered]);
  const standalone = useMemo(() => filtered.filter((c) => c.children.length === 0), [filtered]);

  // All selectable leaves
  const allLeaves = useMemo(
    () => [...zones.flatMap((z) => z.children), ...standalone],
    [zones, standalone]
  );
  const selected = allLeaves.find((c) => c.id === value);

  // Find parent zone for current value (for pre-expanding)
  const parentZoneOfValue = useMemo(() => {
    if (!value) return null;
    return zones.find((z) => z.children.some((c) => c.id === value)) ?? null;
  }, [value, zones]);

  // Smart suggestion
  const suggestion = useMemo(() => {
    if (!categoryRules || !transactionDescription) return null;
    return findSuggestion(transactionDescription, categoryRules, categories);
  }, [categoryRules, transactionDescription, categories]);

  function handleOpen(nextOpen: boolean) {
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

  function selectCategory(categoryId: string | null) {
    void trackClientEvent({
      event_name: "category_selected",
      flow: "categorize",
      step: "zone_picker",
      entry_point: "cta",
      success: true,
      metadata: { selected_category_id: categoryId },
    });
    onValueChange(categoryId);
    setOpen(false);
  }

  // Trigger button
  const trigger = (
    <Button
      variant="outline"
      className={cn(
        "justify-between font-normal",
        !selected && "text-muted-foreground",
        triggerClassName
      )}
      onClick={isPopover ? undefined : () => handleOpen(true)}
    >
      {selected ? (
        <span className="flex items-center gap-2 truncate">
          <span
            className="inline-flex h-5 items-center gap-1 rounded-full px-1.5 text-[11px] font-medium"
            style={{
              backgroundColor: chipBackground(selected.color),
              color: zoneTextColor(selected.color),
            }}
          >
            {selected.icon && <span>{selected.icon}</span>}
            <span className="truncate">{selected.name_es ?? selected.name}</span>
          </span>
        </span>
      ) : (
        <span className="truncate">{placeholder}</span>
      )}
      <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
    </Button>
  );

  // Inner content (shared across dialog/drawer/popover)
  const pickerContent = (
    <ZonePickerContent
      zones={zones}
      standalone={standalone}
      suggestion={suggestion}
      selectedId={value}
      parentZoneOfValue={parentZoneOfValue}
      direction={direction}
      onSelect={selectCategory}
    />
  );

  if (isPopover) {
    return (
      <>
        {name && <input type="hidden" name={name} value={value ?? ""} />}
        <Popover open={open} onOpenChange={handleOpen}>
          <PopoverTrigger asChild>{trigger}</PopoverTrigger>
          <PopoverContent
            className="w-[320px] max-w-[min(22rem,calc(100vw-2rem))] p-0 overflow-hidden"
            align="start"
            sideOffset={8}
          >
            {pickerContent}
          </PopoverContent>
        </Popover>
      </>
    );
  }

  if (resolvedVariant === "drawer") {
    return (
      <>
        {name && <input type="hidden" name={name} value={value ?? ""} />}
        {trigger}
        <Drawer open={open} onOpenChange={handleOpen}>
          <DrawerContent>
            <DrawerHeader>
              <DrawerTitle>Elegir categoría</DrawerTitle>
            </DrawerHeader>
            <div className="overflow-y-auto px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {pickerContent}
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  // Dialog (desktop default)
  return (
    <>
      {name && <input type="hidden" name={name} value={value ?? ""} />}
      {trigger}
      <Dialog open={open} onOpenChange={handleOpen}>
        <DialogContent className="flex max-h-[70vh] w-full max-w-md flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-4 py-3">
            <DialogTitle>Selecciona una categoría</DialogTitle>
            <DialogDescription>
              Elige la zona y luego la categoría que mejor describe este movimiento.
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

// ─── Inner picker content ─────────────────────────────────────────────────────

interface ZonePickerContentProps {
  zones: CategoryWithChildren[];
  standalone: CategoryWithChildren[];
  suggestion: ReturnType<typeof findSuggestion>;
  selectedId: string | null;
  parentZoneOfValue: CategoryWithChildren | null;
  direction?: TransactionDirection;
  onSelect: (id: string | null) => void;
}

function ZonePickerContent({
  zones,
  standalone,
  suggestion,
  selectedId,
  parentZoneOfValue,
  direction,
  onSelect,
}: ZonePickerContentProps) {
  const [expandedZoneId, setExpandedZoneId] = useState<string | null>(
    parentZoneOfValue?.id ?? null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  const isSearching = searchQuery.trim().length > 0;

  // Flat filtered results for search mode
  const searchResults = useMemo(() => {
    if (!isSearching) return [];
    const q = searchQuery.toLowerCase();
    const results: { category: Category; parentColor: string; parentName: string }[] = [];
    for (const zone of zones) {
      for (const child of zone.children) {
        const name = (child.name_es ?? child.name).toLowerCase();
        if (name.includes(q)) {
          results.push({
            category: child,
            parentColor: zone.color,
            parentName: zone.name_es ?? zone.name,
          });
        }
      }
    }
    for (const cat of standalone) {
      const name = (cat.name_es ?? cat.name).toLowerCase();
      if (name.includes(q)) {
        results.push({
          category: cat,
          parentColor: cat.color,
          parentName: "Otros",
        });
      }
    }
    return results;
  }, [searchQuery, zones, standalone, isSearching]);

  const expandedZone = zones.find((z) => z.id === expandedZoneId);

  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Smart suggestion */}
      {suggestion && (
        <button
          type="button"
          onClick={() => onSelect(suggestion.categoryId)}
          className="flex items-center gap-2.5 rounded-lg p-2.5 text-left transition-colors hover:opacity-80"
          style={{
            backgroundColor: "rgba(168, 162, 120, 0.1)",
            borderWidth: "1px",
            borderColor: "rgba(168, 162, 120, 0.25)",
          }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wider text-z-brass">
            Sugerencia
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium"
            style={{
              backgroundColor: chipBackground(suggestion.categoryColor),
              color: zoneTextColor(suggestion.categoryColor),
            }}
          >
            {suggestion.categoryIcon && <span>{suggestion.categoryIcon}</span>}
            {suggestion.categoryName}
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground">
            {suggestion.reason}
          </span>
        </button>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar o crear categoría..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-9 pl-8 text-sm"
        />
      </div>

      {/* Search results mode */}
      {isSearching ? (
        <div className="flex flex-col gap-1">
          {searchResults.length > 0 ? (
            searchResults.map(({ category: cat, parentColor, parentName }) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => onSelect(cat.id)}
                className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent/50"
              >
                <span
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-xs"
                  style={{ backgroundColor: chipBackground(parentColor) }}
                >
                  {cat.icon}
                </span>
                <span>{cat.name_es ?? cat.name}</span>
                <span className="ml-auto text-[10px] text-muted-foreground">
                  {parentName}
                </span>
                {selectedId === cat.id && (
                  <Check className="h-4 w-4 text-primary" />
                )}
              </button>
            ))
          ) : (
            <div className="py-3 text-center text-sm text-muted-foreground">
              <p>Sin resultados</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-1 text-xs"
                onClick={() => {
                  setShowCreateForm(true);
                  setSearchQuery("");
                }}
              >
                Crear &ldquo;{searchQuery}&rdquo;
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Zone grid */}
          <div className="grid grid-cols-2 gap-2">
            {zones.map((zone) => (
              <button
                key={zone.id}
                type="button"
                onClick={() =>
                  setExpandedZoneId(
                    expandedZoneId === zone.id ? null : zone.id
                  )
                }
                className={cn(
                  "rounded-xl p-2.5 text-left transition-all",
                  expandedZoneId === zone.id && "ring-2"
                )}
                style={{
                  backgroundColor: zoneBackground(zone.color),
                  borderWidth: "1px",
                  borderColor: zoneBorder(zone.color),
                  ...(expandedZoneId === zone.id
                    ? { ringColor: zone.color }
                    : {}),
                }}
              >
                <div className="flex flex-col items-center gap-1 py-1">
                  <span className="text-xl">{zone.icon}</span>
                  <span
                    className="text-xs font-medium"
                    style={{ color: zoneTextColor(zone.color) }}
                  >
                    {zone.name_es ?? zone.name}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {/* Expanded subcategory list */}
          {expandedZone && (
            <div className="flex flex-col gap-0.5">
              <div
                className="mb-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: zoneTextColor(expandedZone.color) }}
              >
                {expandedZone.icon} {expandedZone.name_es ?? expandedZone.name}
              </div>
              {expandedZone.children.map((child) => (
                <button
                  key={child.id}
                  type="button"
                  onClick={() => onSelect(child.id)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent/50"
                  style={{
                    backgroundColor:
                      selectedId === child.id
                        ? chipBackground(expandedZone.color)
                        : undefined,
                  }}
                >
                  <span className="text-sm">{child.icon}</span>
                  <span>{child.name_es ?? child.name}</span>
                  {selectedId === child.id && (
                    <Check className="ml-auto h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* Standalone categories (no parent) */}
          {standalone.length > 0 && !expandedZone && (
            <div className="flex flex-col gap-0.5">
              <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Otros
              </div>
              {standalone.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onSelect(cat.id)}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent/50"
                >
                  <span className="text-sm">{cat.icon}</span>
                  <span>{cat.name_es ?? cat.name}</span>
                  {selectedId === cat.id && (
                    <Check className="ml-auto h-4 w-4 text-primary" />
                  )}
                </button>
              ))}
            </div>
          )}

          {/* "No category" option */}
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/50"
          >
            <X className="h-4 w-4 opacity-50" />
            Sin categoría
            {selectedId === null && (
              <Check className="ml-auto h-4 w-4 text-primary" />
            )}
          </button>
        </>
      )}

      {/* Create new */}
      {showCreateForm ? (
        <div className="border-t pt-2">
          <InlineCategoryForm
            parentId={expandedZoneId}
            direction={direction}
            parentColor={expandedZone?.color}
            parentIcon={expandedZone?.icon}
            initialName={searchQuery}
            onCreated={(id) => {
              setShowCreateForm(false);
              onSelect(id);
            }}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowCreateForm(true)}
          className="border-t pt-2 text-left text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          + Crear nueva categoría...
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd webapp && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors. Fix any type issues if they appear.

- [ ] **Step 3: Commit**

```bash
cd webapp && git add src/components/categories/category-zone-picker.tsx
git commit -m "feat(categories): add CategoryZonePicker — two-step zone picker with suggestions and inline create"
```

---

## Task 8: Replace CategoryPickerDialog Usages (3 files)

**Files:**
- Modify: `webapp/src/components/categorize/inbox-transaction-row.tsx`
- Modify: `webapp/src/components/categorize/auto-review-row.tsx`
- Modify: `webapp/src/components/categorize/bulk-action-bar.tsx`

- [ ] **Step 1: Update inbox-transaction-row.tsx**

Replace the import and usage:

```tsx
// In inbox-transaction-row.tsx, change:
import { CategoryPickerDialog } from "@/components/categorize/category-picker-dialog";
// To:
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
```

And in the JSX, replace `<CategoryPickerDialog` with `<CategoryZonePicker` (same props — they're compatible).

- [ ] **Step 2: Update auto-review-row.tsx**

Same swap: `CategoryPickerDialog` → `CategoryZonePicker` (import and JSX usage).

- [ ] **Step 3: Update bulk-action-bar.tsx**

Same swap: `CategoryPickerDialog` → `CategoryZonePicker` (import and JSX usage).

- [ ] **Step 4: Verify build passes**

Run: `cd webapp && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
cd webapp && git add src/components/categorize/inbox-transaction-row.tsx src/components/categorize/auto-review-row.tsx src/components/categorize/bulk-action-bar.tsx
git commit -m "refactor(categorize): replace CategoryPickerDialog with CategoryZonePicker"
```

---

## Task 9: Replace CategoryCombobox Usages (10 files)

**Files:**
- Modify: `webapp/src/components/transactions/transaction-form.tsx`
- Modify: `webapp/src/components/transactions/quick-capture-bar.tsx`
- Modify: `webapp/src/components/transactions/transaction-table.tsx`
- Modify: `webapp/src/components/recurring/recurring-form.tsx`
- Modify: `webapp/src/components/destinatarios/destinatario-suggestions-tab.tsx`
- Modify: `webapp/src/components/dashboard/purchase-decision-card.tsx`
- Modify: `webapp/src/components/import/parsed-transaction-table.tsx`
- Modify: `webapp/src/components/import/step-destinatarios.tsx`
- Modify: `webapp/src/components/mobile/mobile-transaction-form.tsx`
- Modify: `webapp/src/components/mobile/mobile-presupuesto.tsx`

All replacements follow the same pattern:

```tsx
// Change import from:
import { CategoryCombobox } from "@/components/ui/category-combobox";
// To:
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
```

In JSX, replace `<CategoryCombobox` with `<CategoryZonePicker variant="popover"`. The props are compatible:
- `categories` → same
- `value` → same
- `onValueChange` → same
- `direction` → same
- `placeholder` → same
- `triggerClassName` → same
- `name` → same

The only addition is `variant="popover"` to maintain the inline popover behavior that `CategoryCombobox` had.

- [ ] **Step 1: Update transaction-form.tsx, quick-capture-bar.tsx, transaction-table.tsx**

Swap import and JSX in each file. Add `variant="popover"` prop.

- [ ] **Step 2: Update recurring-form.tsx, destinatario-suggestions-tab.tsx, purchase-decision-card.tsx**

Same swap in each file.

- [ ] **Step 3: Update import/parsed-transaction-table.tsx (2 usages), import/step-destinatarios.tsx**

Same swap. Note `parsed-transaction-table.tsx` has two `<CategoryCombobox` instances — replace both.

- [ ] **Step 4: Update mobile-transaction-form.tsx, mobile-presupuesto.tsx**

Same swap in each file.

- [ ] **Step 5: Verify build passes**

Run: `cd webapp && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors. The `CategoryCombobox` import should now have zero consumers.

- [ ] **Step 6: Commit**

```bash
cd webapp && git add \
  src/components/transactions/transaction-form.tsx \
  src/components/transactions/quick-capture-bar.tsx \
  src/components/transactions/transaction-table.tsx \
  src/components/recurring/recurring-form.tsx \
  src/components/destinatarios/destinatario-suggestions-tab.tsx \
  src/components/dashboard/purchase-decision-card.tsx \
  src/components/import/parsed-transaction-table.tsx \
  src/components/import/step-destinatarios.tsx \
  src/components/mobile/mobile-transaction-form.tsx \
  src/components/mobile/mobile-presupuesto.tsx
git commit -m "refactor: replace all CategoryCombobox usages with CategoryZonePicker"
```

---

## Task 10: CategoryZoneManager

**Files:**
- Create: `webapp/src/components/categories/category-zone-manager.tsx`

- [ ] **Step 1: Create the zone manager component**

```tsx
// webapp/src/components/categories/category-zone-manager.tsx
"use client";

import { useState, useEffect, useTransition } from "react";
import { Plus, Eye, EyeOff, Trash2, GripVertical, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  zoneBackground,
  zoneBorder,
  zoneTextColor,
  chipBackground,
} from "@/lib/utils/zone-colors";
import { SubcategoryChip } from "./subcategory-chip";
import { IconPicker } from "./icon-picker";
import { ColorPicker } from "./color-picker";
import { InlineCategoryForm } from "./inline-category-form";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryActive,
  updateCategoryOrder,
} from "@/actions/categories";
import { toast } from "sonner";
import type { CategoryBudgetData } from "@/types/domain";

interface CategoryZoneManagerProps {
  categories: CategoryBudgetData[];
}

export function CategoryZoneManager({ categories }: CategoryZoneManagerProps) {
  const [localCategories, setLocalCategories] = useState(categories);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  const editingZone = localCategories.find((c) => c.id === editingZoneId);

  return (
    <div className="space-y-4">
      {/* Zone grid */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {localCategories.map((zone) => (
          <ZoneCard
            key={zone.id}
            zone={zone}
            isEditing={editingZoneId === zone.id}
            onToggleEdit={() =>
              setEditingZoneId(editingZoneId === zone.id ? null : zone.id)
            }
            onUpdate={() => {
              // Optimistic updates happen inside ZoneCard;
              // server revalidation refreshes localCategories via the useEffect
            }}
            isPending={isPending}
          />
        ))}

        {/* New zone tile */}
        <NewZoneTile />
      </div>
    </div>
  );
}

// ─── Zone Card ────────────────────────────────────────────────────────────────

interface ZoneCardProps {
  zone: CategoryBudgetData;
  isEditing: boolean;
  onToggleEdit: () => void;
  onUpdate: () => void;
  isPending: boolean;
}

function ZoneCard({
  zone,
  isEditing,
  onToggleEdit,
  onUpdate,
  isPending,
}: ZoneCardProps) {
  const [editName, setEditName] = useState(zone.name_es ?? zone.name);
  const [editIcon, setEditIcon] = useState(zone.icon);
  const [editColor, setEditColor] = useState(zone.color);
  const [isSaving, startSaving] = useTransition();

  // Reset edit state when zone changes
  useEffect(() => {
    setEditName(zone.name_es ?? zone.name);
    setEditIcon(zone.icon);
    setEditColor(zone.color);
  }, [zone]);

  function generateSlug(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 50);
  }

  function handleSaveZone() {
    const formData = new FormData();
    formData.append("name", editName);
    formData.append("name_es", editName);
    formData.append("slug", generateSlug(editName));
    formData.append("icon", editIcon);
    formData.append("color", editColor);
    if (zone.direction) formData.append("direction", zone.direction);
    formData.append("is_essential", String(zone.is_essential));

    startSaving(async () => {
      const result = await updateCategory(
        zone.id,
        { success: false, error: "" },
        formData
      );
      if (result.success) {
        toast.success("Zona actualizada");
        onToggleEdit();
      } else {
        toast.error(result.error ?? "Error al guardar");
      }
    });
  }

  async function handleToggleActive() {
    const result = await toggleCategoryActive(zone.id, !zone.is_active);
    if (!result.success) {
      toast.error("Error al cambiar visibilidad");
    }
  }

  async function handleDeleteSubcategory(childId: string) {
    const result = await deleteCategory(childId);
    if (!result.success) {
      toast.error("Error al eliminar subcategoría");
    }
  }

  const color = isEditing ? editColor : zone.color;
  const name = isEditing ? editName : (zone.name_es ?? zone.name);
  const icon = isEditing ? editIcon : zone.icon;

  return (
    <div
      className={cn(
        "rounded-xl transition-all",
        !zone.is_active && "opacity-50",
        isEditing && "ring-2 col-span-1 sm:col-span-2 xl:col-span-3"
      )}
      style={{
        backgroundColor: zoneBackground(color),
        borderWidth: "1px",
        borderColor: zoneBorder(color),
        ...(isEditing ? { ringColor: color } : {}),
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 p-3">
        <span className="text-lg">{icon}</span>
        <span
          className="text-sm font-semibold truncate"
          style={{ color: zoneTextColor(color) }}
        >
          {name}
        </span>
        {zone.is_essential && (
          <Badge variant="secondary" className="text-[10px]">Esencial</Badge>
        )}
        {!zone.is_active && (
          <Badge variant="outline" className="text-[10px]">Oculta</Badge>
        )}
        <Badge variant="outline" className="text-[10px] text-muted-foreground">
          {zone.direction === "OUTFLOW" ? "Gasto" : "Ingreso"}
        </Badge>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {zone.children.length}
        </span>

        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleToggleActive}
            title={zone.is_active ? "Ocultar" : "Mostrar"}
          >
            {zone.is_active ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onToggleEdit}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Collapsed: chip cloud */}
      {!isEditing && zone.children.length > 0 && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-3">
          {zone.children.map((child) => (
            <SubcategoryChip
              key={child.id}
              name={child.name_es ?? child.name}
              icon={child.icon}
              color={color}
            />
          ))}
        </div>
      )}

      {/* Expanded: edit mode */}
      {isEditing && (
        <div className="border-t px-3 pb-3 pt-3 space-y-4" style={{ borderColor: zoneBorder(color) }}>
          {/* Zone name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Nombre</label>
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-8 text-sm"
            />
          </div>

          {/* Icon picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Ícono</label>
            <IconPicker value={editIcon} onValueChange={setEditIcon} />
          </div>

          {/* Color picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Color</label>
            <ColorPicker value={editColor} onValueChange={setEditColor} />
          </div>

          {/* Subcategories list */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Subcategorías</label>
            <div className="flex flex-col gap-1">
              {zone.children.map((child) => (
                <div
                  key={child.id}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-accent/30"
                >
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground cursor-grab" />
                  <span className="text-sm">{child.icon}</span>
                  <span className="flex-1 truncate">{child.name_es ?? child.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteSubcategory(child.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Add subcategory */}
            <InlineCategoryForm
              parentId={zone.id}
              direction={zone.direction}
              parentColor={editColor}
              parentIcon={editIcon}
              placeholder="Nueva subcategoría..."
            />
          </div>

          {/* Save / Cancel */}
          <div className="flex justify-end gap-2 pt-2 border-t" style={{ borderColor: zoneBorder(color) }}>
            <Button
              variant="outline"
              size="sm"
              onClick={onToggleEdit}
              disabled={isSaving}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              onClick={handleSaveZone}
              disabled={isSaving || !editName.trim()}
            >
              {isSaving ? "Guardando..." : "Guardar zona"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── New Zone Tile ────────────────────────────────────────────────────────────

function NewZoneTile() {
  const [isCreating, setIsCreating] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("📦");
  const [color, setColor] = useState("#6366f1");
  const [isPending, startTransition] = useTransition();

  function generateSlug(value: string) {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 50);
  }

  function handleCreate() {
    if (!name.trim()) return;

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("name_es", name.trim());
    formData.append("slug", generateSlug(name.trim()));
    formData.append("icon", icon);
    formData.append("color", color);
    formData.append("direction", "OUTFLOW");
    formData.append("is_essential", "false");

    startTransition(async () => {
      const result = await createCategory(
        { success: false, error: "" },
        formData
      );
      if (result.success) {
        toast.success(`Zona "${name.trim()}" creada`);
        setName("");
        setIcon("📦");
        setColor("#6366f1");
        setIsCreating(false);
      } else {
        toast.error(result.error ?? "Error al crear zona");
      }
    });
  }

  if (!isCreating) {
    return (
      <button
        type="button"
        onClick={() => setIsCreating(true)}
        className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/20 p-6 text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:text-foreground"
      >
        <Plus className="h-6 w-6" />
        <span className="text-sm font-medium">Nueva zona</span>
      </button>
    );
  }

  return (
    <div
      className="rounded-xl p-3 space-y-3"
      style={{
        backgroundColor: zoneBackground(color),
        borderWidth: "1px",
        borderColor: zoneBorder(color),
      }}
    >
      <Input
        placeholder="Nombre de la zona..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="h-8 text-sm"
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleCreate();
          }
        }}
        autoFocus
      />
      <IconPicker value={icon} onValueChange={setIcon} />
      <ColorPicker value={color} onValueChange={setColor} />
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsCreating(false)}
          disabled={isPending}
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          onClick={handleCreate}
          disabled={isPending || !name.trim()}
        >
          {isPending ? "Creando..." : "Crear zona"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build passes**

Run: `cd webapp && npx tsc --noEmit --pretty 2>&1 | head -30`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd webapp && git add src/components/categories/category-zone-manager.tsx
git commit -m "feat(categories): add CategoryZoneManager — tile grid with inline editing"
```

---

## Task 11: Swap Management Tab in Categories Page

**Files:**
- Modify: `webapp/src/app/(dashboard)/categories/page.tsx`

- [ ] **Step 1: Update the categories page**

Replace the `CategoryManageList` import and usage:

```tsx
// Change import from:
import { CategoryManageList } from "@/components/budget/category-manage-list";
// To:
import { CategoryZoneManager } from "@/components/categories/category-zone-manager";
```

In the JSX, replace:
```tsx
<TabsContent value="gestionar" className="mt-4">
  <CategoryManageList categories={allCategories} />
</TabsContent>
```
With:
```tsx
<TabsContent value="gestionar" className="mt-4">
  <CategoryZoneManager categories={allCategories} />
</TabsContent>
```

- [ ] **Step 2: Verify build passes**

Run: `cd webapp && pnpm build 2>&1 | tail -20`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
cd webapp && git add src/app/\(dashboard\)/categories/page.tsx
git commit -m "feat(categories): swap Gestionar tab to CategoryZoneManager"
```

---

## Task 12: Delete Deprecated Components

**Files:**
- Delete: `webapp/src/components/categorize/category-picker-dialog.tsx`
- Delete: `webapp/src/components/ui/category-combobox.tsx`

- [ ] **Step 1: Verify no remaining imports**

Run: `cd webapp && grep -r "CategoryPickerDialog\|category-picker-dialog" src/ --include="*.tsx" --include="*.ts" | grep -v "node_modules"`
Expected: No results (all consumers replaced)

Run: `cd webapp && grep -r "CategoryCombobox\|category-combobox" src/ --include="*.tsx" --include="*.ts" | grep -v "node_modules"`
Expected: No results (all consumers replaced)

- [ ] **Step 2: Delete the files**

```bash
cd webapp && rm src/components/categorize/category-picker-dialog.tsx src/components/ui/category-combobox.tsx
```

- [ ] **Step 3: Full build verification**

Run: `cd webapp && pnpm build 2>&1 | tail -20`
Expected: Build succeeds with no errors

- [ ] **Step 4: Commit**

```bash
cd webapp && git add -A
git commit -m "refactor(categories): remove deprecated CategoryPickerDialog and CategoryCombobox"
```

---

## Task 13: Run All Tests and Final Verification

- [ ] **Step 1: Run unit tests**

Run: `cd webapp && npx vitest run`
Expected: All tests pass (zone-colors, category-suggestion, plus existing tests)

- [ ] **Step 2: Full production build**

Run: `cd webapp && pnpm build`
Expected: Clean build, no warnings related to category components

- [ ] **Step 3: Verify no unused imports or dead code**

Run: `cd webapp && grep -r "CategoryManageList\|category-manage-list" src/ --include="*.tsx" --include="*.ts"`
Expected: Only the original file itself (if not deleted) or the mobile-presupuesto component that may reference it. Any remaining references should be swapped to `CategoryZoneManager`.

- [ ] **Step 4: Commit any remaining fixes**

If any issues found, fix and commit.
