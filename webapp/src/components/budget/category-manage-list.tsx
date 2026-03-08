"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createCategory } from "@/actions/categories";
import { deleteCategory } from "@/actions/categories";
import { Trash2, Plus } from "lucide-react";
import type { CategoryBudgetData } from "@/types/domain";

interface CategoryManageListProps {
  categories: CategoryBudgetData[];
}

export function CategoryManageList({ categories }: CategoryManageListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [addingToParent, setAddingToParent] = useState<string | null>(null);
  const [newSubName, setNewSubName] = useState("");

  async function handleAddSubcategory(parentId: string) {
    if (!newSubName.trim()) return;

    const parent = categories.find((c) => c.id === parentId);
    const formData = new FormData();
    formData.append("name", newSubName.trim());
    formData.append("name_es", newSubName.trim());
    formData.append("slug", newSubName.trim().toLowerCase().replace(/\s+/g, "-"));
    formData.append("icon", parent?.icon ?? "tag");
    formData.append("color", parent?.color ?? "#6b7280");
    formData.append("parent_id", parentId);
    if (parent?.direction) {
      formData.append("direction", parent.direction);
    }

    const result = await createCategory({ success: false, error: "" }, formData);
    if (result.success) {
      setAddingToParent(null);
      setNewSubName("");
      startTransition(() => {
        router.refresh();
      });
    }
  }

  async function handleDeleteSubcategory(id: string) {
    const result = await deleteCategory(id);
    if (result.success) {
      startTransition(() => {
        router.refresh();
      });
    }
  }

  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <div key={cat.id} className="rounded-lg border">
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
            </div>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => {
                setAddingToParent(
                  addingToParent === cat.id ? null : cat.id
                );
                setNewSubName("");
              }}
              disabled={isPending}
            >
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">Subcategoria</span>
            </Button>
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
                    size="icon-xs"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteSubcategory(child.id)}
                    disabled={isPending}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {/* Add subcategory inline form */}
          {addingToParent === cat.id && (
            <div
              className={cn(
                "flex items-center gap-2 p-3 border-t",
                cat.children.length === 0 && "border-t"
              )}
            >
              <Input
                placeholder="Nombre de subcategoria"
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
                disabled={isPending || !newSubName.trim()}
              >
                Agregar
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
