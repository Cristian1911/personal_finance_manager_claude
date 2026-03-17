"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  createCategory,
  deleteCategory,
  toggleCategoryActive,
} from "@/actions/categories";
import { Trash2, Plus, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import type { CategoryBudgetData } from "@/types/domain";

interface CategoryManageListProps {
  categories: CategoryBudgetData[];
}

export function CategoryManageList({ categories }: CategoryManageListProps) {
  const [localCategories, setLocalCategories] = useState(categories);
  const [addingToParent, setAddingToParent] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  async function handleAddSubcategory(parentId: string) {
    if (!newSubName.trim()) return;
    setIsSaving(true);
    setError(null);

    try {
      const parent = localCategories.find((c) => c.id === parentId);
      const formData = new FormData();
      formData.append("name", newSubName.trim());
      formData.append("name_es", newSubName.trim());
      formData.append(
        "slug",
        newSubName.trim().toLowerCase().replace(/\s+/g, "-")
      );
      formData.append("icon", parent?.icon ?? "tag");
      formData.append("color", parent?.color ?? "#6b7280");
      formData.append("parent_id", parentId);
      if (parent?.direction) {
        formData.append("direction", parent.direction);
      }

      const result = await createCategory(
        { success: false, error: "" },
        formData
      );
      if (result.success) {
        setAddingToParent(null);
        setNewSubName("");
      } else {
        setError(result.error ?? "Error al crear subcategoría");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteSubcategory(id: string) {
    setLocalCategories(prev => prev.filter(c => c.id !== id));
    const result = await deleteCategory(id);
    if (!result.success) {
      setLocalCategories(categories);
      toast.error("Error al eliminar");
    }
  }

  async function handleToggleActive(id: string, currentlyActive: boolean) {
    setLocalCategories(prev => prev.map(c =>
      c.id === id ? { ...c, is_active: !currentlyActive } : c
    ));
    const result = await toggleCategoryActive(id, !currentlyActive);
    if (!result.success) {
      setLocalCategories(categories);
    }
  }

  return (
    <div className="space-y-4">
      {localCategories.map((cat) => (
        <div
          key={cat.id}
          className={cn("rounded-lg border", !cat.is_active && "opacity-50")}
        >
          {/* Parent header */}
          <div className="flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-block size-3 rounded-full shrink-0"
                style={{ backgroundColor: cat.color }}
              />
              <span className="text-sm font-medium">
                {cat.name_es ?? cat.name}
              </span>
              {cat.is_essential && (
                <Badge variant="secondary" className="text-[10px]">
                  Esencial
                </Badge>
              )}
              {!cat.is_active && (
                <Badge variant="outline" className="text-[10px]">
                  Oculta
                </Badge>
              )}
              <Badge
                variant="outline"
                className="text-[10px] text-muted-foreground"
              >
                {cat.direction === "OUTFLOW" ? "Gasto" : "Ingreso"}
              </Badge>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => handleToggleActive(cat.id, cat.is_active)}
                disabled={isSaving}
                title={cat.is_active ? "Ocultar categoría" : "Mostrar categoría"}
              >
                {cat.is_active ? (
                  <EyeOff className="size-3.5" />
                ) : (
                  <Eye className="size-3.5" />
                )}
              </Button>
              {cat.is_active && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setAddingToParent(
                      addingToParent === cat.id ? null : cat.id
                    );
                    setNewSubName("");
                    setError(null);
                  }}
                  disabled={isSaving}
                >
                  <Plus className="size-3.5" />
                  <span className="hidden sm:inline">Subcategoría</span>
                </Button>
              )}
            </div>
          </div>

          {/* Subcategories list */}
          {cat.children.length > 0 && (
            <ul className="border-t">
              {cat.children.map((child) => (
                <li
                  key={child.id}
                  className="flex items-center justify-between py-2 px-3 pl-8 text-sm text-muted-foreground hover:bg-muted/50"
                >
                  <span>{child.name_es ?? child.name}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive h-7 w-7"
                    onClick={() => handleDeleteSubcategory(child.id)}
                    disabled={isSaving}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {/* Add subcategory inline form */}
          {addingToParent === cat.id && (
            <div className="flex flex-col gap-2 p-3 border-t">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Nombre de subcategoría"
                  value={newSubName}
                  onChange={(e) => setNewSubName(e.target.value)}
                  className="h-8 text-sm"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddSubcategory(cat.id);
                    }
                  }}
                />
                <Button
                  size="sm"
                  onClick={() => handleAddSubcategory(cat.id)}
                  disabled={isSaving || !newSubName.trim()}
                >
                  {isSaving ? "..." : "Agregar"}
                </Button>
              </div>
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
