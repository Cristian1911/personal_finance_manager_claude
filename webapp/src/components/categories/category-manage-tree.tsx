"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
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
                aria-label={isExpanded ? "Colapsar" : "Expandir"}
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>

              <span className="text-lg">{parent.icon}</span>

              <div
                className="h-2.5 w-2.5 rounded-full shrink-0"
                style={{ backgroundColor: parent.color }}
              />

              <span className="text-sm font-semibold flex-1">{parentName}</span>

              {parent.is_system && (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  sistema
                </Badge>
              )}

              <Badge variant="secondary" className="text-xs">
                {parent.direction === "INFLOW" ? "Ingresos" : "Gastos"}
              </Badge>

              {/* Aggregated budget (read-only) */}
              <span className="text-sm text-muted-foreground min-w-[80px] text-right">
                {parent.childBudgetTotal > 0
                  ? `${formatCurrency(parent.childBudgetTotal, "COP")}/mes`
                  : "—"}
              </span>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">Acciones</span>
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
                  // Cast child to CategoryWithBudget — children don't have childBudgetTotal computed
                  // but the type is compatible for modal props (childBudgetTotal will be 0)
                  const childWithBudget = child as CategoryWithBudget;
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
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          sistema
                        </Badge>
                      )}
                      {child.is_essential && (
                        <Badge variant="outline" className="text-xs">
                          Esencial
                        </Badge>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Acciones</span>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(childWithBudget)}>
                            <Pencil className="h-4 w-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => openDelete(childWithBudget)}
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
          otherCategories={allLeafCategories.filter(
            (c) => c.id !== deleteModal.category?.id
          )}
        />
      )}
    </div>
  );
}
