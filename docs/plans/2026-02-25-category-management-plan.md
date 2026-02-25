# Category Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a `/categories/manage` page with full CRUD for categories (including system categories with warning), parent budget aggregation, and a 2-step delete-with-reassignment flow.

**Architecture:** New page at `/categories/manage` backed by extended server actions. The tree view is a new server component; modals are client components. Parent budget totals are computed server-side when building the tree. Delete with reassignment is a new server action that wraps two operations atomically.

**Tech Stack:** Next.js 15 Server Actions, React 19, Supabase, Zod, shadcn/ui (Dialog, DropdownMenu, Select), Lucide icons, Sonner toasts.

---

## Reference Files

- `webapp/src/actions/categories.ts` — server actions (CRUD + tree builder)
- `webapp/src/actions/budgets.ts` — budget server actions
- `webapp/src/types/domain.ts` — `Category`, `CategoryWithChildren`, `Budget`
- `webapp/src/lib/validators/category.ts` — Zod schema
- `webapp/src/app/(dashboard)/categories/page.tsx` — existing categories page
- `webapp/src/components/categories/sortable-category-list.tsx` — existing DnD list
- `webapp/src/lib/constants/navigation.ts` — nav items

---

## Task 1: Extend `getCategories` to include parent budget aggregation

**Files:**
- Modify: `webapp/src/actions/categories.ts`
- Modify: `webapp/src/types/domain.ts`

**Goal:** When building the category tree, sum each parent's children's monthly budgets and attach as `childBudgetTotal`.

**Step 1: Add `CategoryWithBudget` type to `domain.ts`**

In `webapp/src/types/domain.ts`, add after `CategoryWithChildren`:

```typescript
export type CategoryWithBudget = CategoryWithChildren & {
  childBudgetTotal: number; // Sum of children's monthly budgets (0 if none)
};
```

**Step 2: Add `getCategoriesWithBudgets` action to `categories.ts`**

Add this function to `webapp/src/actions/categories.ts`:

```typescript
export async function getCategoriesWithBudgets(
  direction?: TransactionDirection
): Promise<ActionResult<CategoryWithBudget[]>> {
  const supabase = await createClient();

  let query = supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (direction) {
    query = query.or(`direction.eq.${direction},direction.is.null`);
  }

  const { data: categories, error } = await query;
  if (error) return { success: false, error: error.message };

  const { data: budgets } = await supabase
    .from("budgets")
    .select("category_id, amount, period")
    .eq("period", "monthly");

  const budgetByCategory = new Map<string, number>();
  for (const b of budgets ?? []) {
    budgetByCategory.set(b.category_id, Number(b.amount));
  }

  const allCategories = categories ?? [];
  const tree = buildCategoryTreeWithBudgets(allCategories, budgetByCategory);
  return { success: true, data: tree };
}

function buildCategoryTreeWithBudgets(
  categories: Category[],
  budgetByCategory: Map<string, number>
): CategoryWithBudget[] {
  const map = new Map<string, CategoryWithBudget>();
  const roots: CategoryWithBudget[] = [];

  for (const cat of categories) {
    map.set(cat.id, { ...cat, children: [], childBudgetTotal: 0 });
  }

  for (const cat of categories) {
    const node = map.get(cat.id)!;
    if (cat.parent_id && map.has(cat.parent_id)) {
      map.get(cat.parent_id)!.children.push(node);
    } else if (!cat.parent_id) {
      roots.push(node);
    }
  }

  // Compute parent totals after tree is built
  for (const root of roots) {
    root.childBudgetTotal = root.children.reduce(
      (sum, child) => sum + (budgetByCategory.get(child.id) ?? 0),
      0
    );
  }

  return roots;
}
```

**Step 3: Verify the action works manually**

Run the dev server (`pnpm web`) and confirm no TypeScript errors.

**Step 4: Commit**

```bash
cd ~/Documents/developing/personal_finance_manager
git add webapp/src/actions/categories.ts webapp/src/types/domain.ts
git commit -m "feat(categories): add getCategoriesWithBudgets with parent aggregation"
```

---

## Task 2: Add `getCategoryTransactionCount` and `reassignAndDeleteCategory` actions

**Files:**
- Modify: `webapp/src/actions/categories.ts`

**Goal:** Count transactions before delete. If any exist, require reassignment target. Delete executes reassignment + delete in two DB calls.

**Step 1: Add `getCategoryTransactionCount`**

```typescript
export async function getCategoryTransactionCount(
  categoryId: string
): Promise<ActionResult<number>> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId);

  if (error) return { success: false, error: error.message };
  return { success: true, data: count ?? 0 };
}
```

**Step 2: Add `reassignAndDeleteCategory`**

```typescript
export async function reassignAndDeleteCategory(
  id: string,
  reassignToCategoryId?: string
): Promise<ActionResult> {
  const supabase = await createClient();

  // Reassign transactions if target provided
  if (reassignToCategoryId) {
    const { error: reassignError } = await supabase
      .from("transactions")
      .update({ category_id: reassignToCategoryId })
      .eq("category_id", id);

    if (reassignError) return { success: false, error: reassignError.message };
  }

  // Delete the category (cascade removes budgets)
  const { error: deleteError } = await supabase
    .from("categories")
    .delete()
    .eq("id", id);

  if (deleteError) return { success: false, error: deleteError.message };

  revalidatePath("/categories");
  revalidatePath("/categories/manage");
  return { success: true, data: undefined };
}
```

Note: This removes the `is_system = false` guard from the original `deleteCategory`. System category deletion is controlled in the UI by requiring the user to confirm the warning modal.

**Step 3: Update `updateCategory` to support system categories**

Change the existing `updateCategory` action — remove the `.eq("is_system", false)` guard so system categories can be modified:

```typescript
// BEFORE:
const { data, error } = await supabase
  .from("categories")
  .update(parsed.data)
  .eq("id", id)
  .eq("is_system", false)   // ← remove this line
  .select()
  .single();

// AFTER:
const { data, error } = await supabase
  .from("categories")
  .update(parsed.data)
  .eq("id", id)
  .select()
  .single();
```

The is_system guard is now in the UI (warning modal), not the action.

**Step 4: Commit**

```bash
git add webapp/src/actions/categories.ts
git commit -m "feat(categories): add transaction count, reassign-and-delete, allow system edit"
```

---

## Task 3: Create `CategoryFormModal` component

**Files:**
- Create: `webapp/src/components/categories/category-form-modal.tsx`

**Goal:** A dialog for creating or editing a category. Shows a warning banner for system categories. Auto-generates slug from name.

```typescript
"use client";

import { useState, useTransition } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { createCategory, updateCategory } from "@/actions/categories";
import type { CategoryWithBudget } from "@/types/domain";

interface CategoryFormModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Editing existing category — null means creating new */
  category?: CategoryWithBudget | null;
  /** Available parents for the "Grupo padre" dropdown */
  parentOptions: { id: string; name: string }[];
  /** Pre-selected parent_id when creating a subcategory */
  defaultParentId?: string | null;
}

export function CategoryFormModal({
  open,
  onOpenChange,
  category,
  parentOptions,
  defaultParentId,
}: CategoryFormModalProps) {
  const isEditing = !!category;
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(category?.name ?? "");
  const [nameEs, setNameEs] = useState(category?.name_es ?? "");
  const [icon, setIcon] = useState(category?.icon ?? "tag");
  const [color, setColor] = useState(category?.color ?? "#6b7280");
  const [direction, setDirection] = useState<string>(category?.direction ?? "OUTFLOW");
  const [parentId, setParentId] = useState<string>(
    category?.parent_id ?? defaultParentId ?? "__none__"
  );

  function generateSlug(value: string) {
    return value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .slice(0, 50);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const formData = new FormData();
    formData.append("name", name);
    if (nameEs) formData.append("name_es", nameEs);
    formData.append("slug", generateSlug(name));
    formData.append("icon", icon);
    formData.append("color", color);
    formData.append("direction", direction);
    if (parentId !== "__none__") formData.append("parent_id", parentId);
    formData.append("is_essential", "false");

    startTransition(async () => {
      const result = isEditing
        ? await updateCategory(category!.id, { success: false, error: "" }, formData)
        : await createCategory({ success: false, error: "" }, formData);

      if (result.success) {
        toast.success(isEditing ? "Categoría actualizada" : "Categoría creada");
        onOpenChange(false);
      } else {
        toast.error(result.error ?? "Error al guardar");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? `Editar ${category!.name}` : "Nueva categoría"}</DialogTitle>
        </DialogHeader>

        {isEditing && category!.is_system && (
          <div className="flex items-start gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>Esta es una categoría del sistema. Los cambios afectan a todos los usuarios.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="name">Nombre</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Alimentación"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="name_es">Nombre en español <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <Input
              id="name_es"
              value={nameEs}
              onChange={(e) => setNameEs(e.target.value)}
              placeholder="Ej: Alimentación"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="icon">Ícono (emoji)</Label>
              <Input
                id="icon"
                value={icon}
                onChange={(e) => setIcon(e.target.value)}
                placeholder="🍕"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="color">Color</Label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  id="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-9 w-9 rounded-md border cursor-pointer p-0.5"
                />
                <Input value={color} onChange={(e) => setColor(e.target.value)} className="font-mono text-xs" />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Dirección</Label>
            <Select value={direction} onValueChange={setDirection}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="OUTFLOW">Gastos (OUTFLOW)</SelectItem>
                <SelectItem value="INFLOW">Ingresos (INFLOW)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Grupo padre <span className="text-muted-foreground text-xs">(vacío = es un grupo)</span></Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue placeholder="Sin grupo padre (es un grupo)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin grupo padre</SelectItem>
                {parentOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending || !name}>
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

**Commit:**

```bash
git add webapp/src/components/categories/category-form-modal.tsx
git commit -m "feat(categories): add CategoryFormModal for create/edit"
```

---

## Task 4: Create `DeleteCategoryModal` component

**Files:**
- Create: `webapp/src/components/categories/delete-category-modal.tsx`

**Goal:** 2-step modal. Step 1: count transactions and pick reassignment target. Step 2: confirm summary. Calls `reassignAndDeleteCategory`.

```typescript
"use client";

import { useState, useTransition, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getCategoryTransactionCount, reassignAndDeleteCategory } from "@/actions/categories";
import type { CategoryWithBudget } from "@/types/domain";

interface DeleteCategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: CategoryWithBudget;
  /** All categories except the one being deleted, for reassignment dropdown */
  otherCategories: { id: string; name: string }[];
}

export function DeleteCategoryModal({
  open,
  onOpenChange,
  category,
  otherCategories,
}: DeleteCategoryModalProps) {
  const [step, setStep] = useState<1 | 2>(1);
  const [txCount, setTxCount] = useState<number | null>(null);
  const [reassignTo, setReassignTo] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  // Load transaction count when modal opens
  useEffect(() => {
    if (!open) { setStep(1); setReassignTo(""); setTxCount(null); return; }
    getCategoryTransactionCount(category.id).then((res) => {
      if (res.success) setTxCount(res.data);
    });
  }, [open, category.id]);

  function handleNext() {
    if (txCount && txCount > 0 && !reassignTo) {
      toast.error("Selecciona una categoría de destino");
      return;
    }
    setStep(2);
  }

  function handleConfirm() {
    startTransition(async () => {
      const res = await reassignAndDeleteCategory(
        category.id,
        reassignTo || undefined
      );
      if (res.success) {
        toast.success(`"${category.name_es || category.name}" eliminada`);
        onOpenChange(false);
      } else {
        toast.error(res.error ?? "Error al eliminar");
      }
    });
  }

  const categoryDisplayName = category.name_es || category.name;
  const reassignTarget = otherCategories.find((c) => c.id === reassignTo);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 1 ? `¿Eliminar "${categoryDisplayName}"?` : "Confirmar eliminación"}
          </DialogTitle>
          <DialogDescription>
            {step === 1 ? `Paso 1 de ${txCount ? 2 : 1}` : "Paso 2 de 2"}
          </DialogDescription>
        </DialogHeader>

        {step === 1 && (
          <div className="space-y-4">
            {category.is_system && (
              <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Esta es una categoría del sistema. Eliminarla puede afectar a todos los usuarios.</span>
              </div>
            )}

            {txCount === null && (
              <p className="text-sm text-muted-foreground">Verificando transacciones...</p>
            )}

            {txCount !== null && txCount === 0 && (
              <p className="text-sm text-muted-foreground">
                Esta categoría no tiene transacciones asociadas.
              </p>
            )}

            {txCount !== null && txCount > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Esta categoría tiene <strong>{txCount} transacciones</strong> asociadas. Debes reasignarlas antes de eliminar.
                </p>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Reasignar a:</label>
                  <Select value={reassignTo} onValueChange={setReassignTo}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar categoría..." />
                    </SelectTrigger>
                    <SelectContent>
                      {otherCategories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button
                variant="destructive"
                onClick={txCount && txCount > 0 ? handleNext : handleConfirm}
                disabled={isPending || txCount === null || (txCount > 0 && !reassignTo)}
              >
                {txCount && txCount > 0 ? "Siguiente" : "Eliminar"}
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {reassignTarget
                ? `Se moverán ${txCount} transacciones a "${reassignTarget.name}" y se eliminará "${categoryDisplayName}".`
                : `Se eliminará "${categoryDisplayName}".`}
            </p>
            <p className="text-sm font-medium">Esta acción no se puede deshacer.</p>

            <DialogFooter>
              <Button variant="outline" onClick={() => setStep(1)} disabled={isPending}>Atrás</Button>
              <Button variant="destructive" onClick={handleConfirm} disabled={isPending}>
                {isPending ? "Eliminando..." : "Confirmar"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
```

**Commit:**

```bash
git add webapp/src/components/categories/delete-category-modal.tsx
git commit -m "feat(categories): add DeleteCategoryModal with 2-step reassignment flow"
```

---

## Task 5: Create `CategoryManageTree` client component

**Files:**
- Create: `webapp/src/components/categories/category-manage-tree.tsx`

**Goal:** Tree view with expandable parent rows, ⋮ dropdown per row, inline budget display for parents, and wires to form/delete modals.

```typescript
"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, MoreHorizontal, Plus, Pencil, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { CategoryWithBudget } from "@/types/domain";
import { CategoryFormModal } from "./category-form-modal";
import { DeleteCategoryModal } from "./delete-category-modal";

interface CategoryManageTreeProps {
  categories: CategoryWithBudget[];
}

export function CategoryManageTree({ categories }: CategoryManageTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    new Set(categories.map((c) => c.id)) // all expanded by default
  );

  // Modal state
  const [formModal, setFormModal] = useState<{
    open: boolean;
    category: CategoryWithBudget | null;
    defaultParentId: string | null;
  }>({ open: false, category: null, defaultParentId: null });

  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    category: CategoryWithBudget | null;
  }>({ open: false, category: null });

  // Flat list of all leaf categories for reassignment dropdown
  const allLeafCategories = categories.flatMap((parent) =>
    parent.children.map((child) => ({
      id: child.id,
      name: child.name_es || child.name,
    }))
  );

  // All parents for the "Grupo padre" dropdown in form modal
  const parentOptions = categories.map((c) => ({
    id: c.id,
    name: c.name_es || c.name,
  }));

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function openCreate(defaultParentId?: string) {
    setFormModal({ open: true, category: null, defaultParentId: defaultParentId ?? null });
  }

  function openEdit(category: CategoryWithBudget) {
    setFormModal({ open: true, category, defaultParentId: null });
  }

  function openDelete(category: CategoryWithBudget) {
    setDeleteModal({ open: true, category });
  }

  return (
    <div className="space-y-2">
      {categories.map((parent) => {
        const isExpanded = expandedIds.has(parent.id);
        const parentName = parent.name_es || parent.name;

        return (
          <div key={parent.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
            {/* Parent row */}
            <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border-b">
              <button
                onClick={() => toggleExpand(parent.id)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                {isExpanded
                  ? <ChevronDown className="h-4 w-4" />
                  : <ChevronRight className="h-4 w-4" />
                }
              </button>

              <span className="text-lg">{parent.icon}</span>

              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: parent.color }}
              />

              <span className="text-sm font-semibold flex-1">{parentName}</span>

              {parent.is_system && (
                <Badge variant="outline" className="text-xs text-muted-foreground">sistema</Badge>
              )}

              {/* Direction badge */}
              <Badge variant="secondary" className="text-xs">
                {parent.direction === "INFLOW" ? "Ingresos" : "Gastos"}
              </Badge>

              {/* Aggregated budget (read-only) */}
              <span className="text-sm text-muted-foreground min-w-[80px] text-right">
                {parent.childBudgetTotal > 0
                  ? formatCurrency(parent.childBudgetTotal, "COP") + "/mes"
                  : "—"}
              </span>

              {/* Actions menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => openEdit(parent)}>
                    <Pencil className="h-4 w-4 mr-2" /> Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openCreate(parent.id)}>
                    <Plus className="h-4 w-4 mr-2" /> Agregar subcategoría
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => openDelete(parent)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Children */}
            {isExpanded && (
              <div>
                {parent.children.map((child) => {
                  const childName = child.name_es || child.name;
                  return (
                    <div
                      key={child.id}
                      className="flex items-center gap-2 px-4 py-2.5 border-b last:border-0 hover:bg-muted/30 transition-colors"
                      style={{ paddingLeft: "3rem" }}
                    >
                      <span className="text-base">{child.icon}</span>
                      <div
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: child.color }}
                      />
                      <span className="text-sm flex-1">{childName}</span>

                      {child.is_system && (
                        <Badge variant="outline" className="text-xs text-muted-foreground">sistema</Badge>
                      )}
                      {child.is_essential && (
                        <Badge variant="outline" className="text-xs">Esencial</Badge>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(child as CategoryWithBudget)}>
                            <Pencil className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => openDelete(child as CategoryWithBudget)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}

                {/* Add subcategory shortcut */}
                <button
                  onClick={() => openCreate(parent.id)}
                  className="w-full text-left text-xs text-muted-foreground hover:text-foreground px-12 py-2 hover:bg-muted/30 transition-colors flex items-center gap-1.5"
                >
                  <Plus className="h-3 w-3" /> Agregar subcategoría
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Add group shortcut */}
      <button
        onClick={() => openCreate()}
        className="w-full text-left text-sm text-muted-foreground hover:text-foreground px-4 py-3 border border-dashed rounded-xl hover:bg-muted/30 transition-colors flex items-center gap-2"
      >
        <Plus className="h-4 w-4" /> Agregar grupo
      </button>

      {/* Modals */}
      <CategoryFormModal
        open={formModal.open}
        onOpenChange={(open) => setFormModal((s) => ({ ...s, open }))}
        category={formModal.category}
        parentOptions={parentOptions}
        defaultParentId={formModal.defaultParentId}
      />

      {deleteModal.category && (
        <DeleteCategoryModal
          open={deleteModal.open}
          onOpenChange={(open) => setDeleteModal((s) => ({ ...s, open }))}
          category={deleteModal.category}
          otherCategories={allLeafCategories.filter((c) => c.id !== deleteModal.category?.id)}
        />
      )}
    </div>
  );
}
```

**Commit:**

```bash
git add webapp/src/components/categories/category-manage-tree.tsx
git commit -m "feat(categories): add CategoryManageTree with inline actions and modals"
```

---

## Task 6: Create `/categories/manage` page

**Files:**
- Create: `webapp/src/app/(dashboard)/categories/manage/page.tsx`

```typescript
import { getCategoriesWithBudgets } from "@/actions/categories";
import { CategoryManageTree } from "@/components/categories/category-manage-tree";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default async function CategoryManagePage() {
  const [outflowResult, inflowResult] = await Promise.all([
    getCategoriesWithBudgets("OUTFLOW"),
    getCategoriesWithBudgets("INFLOW"),
  ]);

  const outflow = outflowResult.success ? outflowResult.data : [];
  const inflow = inflowResult.success ? inflowResult.data : [];
  const allCategories = [...outflow, ...inflow];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/categories">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Gestionar categorías</h1>
          <p className="text-muted-foreground text-sm">
            Crea, edita y elimina categorías. Los presupuestos de grupos se calculan automáticamente.
          </p>
        </div>
      </div>

      {allCategories.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">No hay categorías activas.</p>
      ) : (
        <CategoryManageTree categories={allCategories} />
      )}
    </div>
  );
}
```

**Commit:**

```bash
git add webapp/src/app/(dashboard)/categories/manage/page.tsx
git commit -m "feat(categories): add /categories/manage page"
```

---

## Task 7: Add "Gestionar" link from the existing categories page

**Files:**
- Modify: `webapp/src/app/(dashboard)/categories/page.tsx`

Add a button in the page header that links to `/categories/manage`:

```typescript
// Add this import at the top:
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Settings2 } from "lucide-react";

// Replace the existing <div> header:
// BEFORE:
<div>
  <h1 className="text-2xl font-bold">Categorías y Presupuestos</h1>
  <p className="text-muted-foreground">
    Gestiona tus categorías y establece metas de presupuesto mensual
  </p>
</div>

// AFTER:
<div className="flex items-start justify-between">
  <div>
    <h1 className="text-2xl font-bold">Categorías y Presupuestos</h1>
    <p className="text-muted-foreground">
      Gestiona tus categorías y establece metas de presupuesto mensual
    </p>
  </div>
  <Link href="/categories/manage">
    <Button variant="outline" size="sm" className="gap-2">
      <Settings2 className="h-4 w-4" />
      Gestionar
    </Button>
  </Link>
</div>
```

**Commit:**

```bash
git add webapp/src/app/(dashboard)/categories/page.tsx
git commit -m "feat(categories): add 'Gestionar' link to manage page"
```

---

## Task 8: Smoke test + verify

**Step 1:** Run dev server

```bash
cd ~/Documents/developing/personal_finance_manager
pnpm web
```

**Step 2:** Check TypeScript compiles

```bash
cd webapp && pnpm tsc --noEmit
```

Expected: no errors.

**Step 3:** Manual test checklist

- [ ] `/categories` page shows "Gestionar" button that links to `/categories/manage`
- [ ] `/categories/manage` shows tree with all parent groups and their children
- [ ] Parent rows show aggregated budget total (or `—` if none)
- [ ] ⋮ menu on parent: Edit opens pre-filled modal, Add subcategory opens modal with parent pre-selected, Delete opens delete modal
- [ ] ⋮ menu on child: Edit opens pre-filled modal, Delete opens delete modal
- [ ] System categories show "sistema" badge and warning in edit modal
- [ ] Creating a new category (parent): no parent_id selected, saves correctly
- [ ] Creating a subcategory: parent pre-selected, saves correctly
- [ ] Delete category with 0 transactions: single confirm step
- [ ] Delete category with transactions: shows count, requires reassignment target, 2-step confirm

**Step 4:** Final commit if any fixes needed

```bash
git add -p  # stage only what you changed
git commit -m "fix(categories): smoke test fixes"
```

---

## Out of Scope (do NOT implement)

- Mobile category management UI
- Drag-and-drop on the manage page (stays on existing `/categories` page)
- Budget editing from the manage page (stays on existing `/categories` page with BudgetFormDialog)
- Yearly budget aggregation for parents (only monthly for now)
