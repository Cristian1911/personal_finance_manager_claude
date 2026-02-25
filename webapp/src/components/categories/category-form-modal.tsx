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
            <Label htmlFor="name_es">
              Nombre en español{" "}
              <span className="text-muted-foreground text-xs">(opcional)</span>
            </Label>
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
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="font-mono text-xs"
                />
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
            <Label>
              Grupo padre{" "}
              <span className="text-muted-foreground text-xs">(vacío = es un grupo)</span>
            </Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger>
                <SelectValue placeholder="Sin grupo padre (es un grupo)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin grupo padre</SelectItem>
                {parentOptions.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
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
