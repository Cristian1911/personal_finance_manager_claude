"use client";

import { useState, useEffect, useTransition } from "react";
import { Plus, Eye, EyeOff, Trash2, GripVertical, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { zoneBackground, zoneBorder, zoneTextColor } from "@/lib/utils/zone-colors";
import { SubcategoryChip } from "./subcategory-chip";
import { IconPicker } from "./icon-picker";
import { ColorPicker } from "./color-picker";
import { InlineCategoryForm } from "./inline-category-form";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryActive,
} from "@/actions/categories";
import { toast } from "sonner";
import type { CategoryBudgetData } from "@/types/domain";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CategoryZoneManagerProps {
  categories: CategoryBudgetData[];
}

interface ZoneEditState {
  name: string;
  icon: string;
  color: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 50);
}

// ─── ZoneCard ────────────────────────────────────────────────────────────────

function ZoneCard({
  zone,
  isEditing,
  onStartEdit,
  onCancelEdit,
  onSaved,
}: {
  zone: CategoryBudgetData;
  isEditing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaved: () => void;
}) {
  const [editState, setEditState] = useState<ZoneEditState>({
    name: zone.name_es ?? zone.name,
    icon: zone.icon,
    color: zone.color,
  });
  const [isPending, startTransition] = useTransition();

  // Reset edit state when entering edit mode or zone changes
  useEffect(() => {
    if (isEditing) {
      setEditState({
        name: zone.name_es ?? zone.name,
        icon: zone.icon,
        color: zone.color,
      });
    }
  }, [isEditing, zone.name, zone.name_es, zone.icon, zone.color]);

  function handleSave() {
    const trimmed = editState.name.trim();
    if (!trimmed) return;

    const formData = new FormData();
    formData.append("name", trimmed);
    formData.append("name_es", trimmed);
    formData.append("slug", generateSlug(trimmed));
    formData.append("icon", editState.icon);
    formData.append("color", editState.color);
    formData.append("direction", zone.direction);
    formData.append("is_essential", String(zone.is_essential));

    startTransition(async () => {
      const result = await updateCategory(
        zone.id,
        { success: false, error: "" },
        formData
      );
      if (result.success) {
        toast.success(`Zona "${trimmed}" actualizada`);
        onSaved();
      } else {
        toast.error(result.error ?? "Error al actualizar zona");
      }
    });
  }

  function handleToggleActive() {
    startTransition(async () => {
      const result = await toggleCategoryActive(zone.id, !zone.is_active);
      if (result.success) {
        toast.success(
          zone.is_active ? "Zona ocultada" : "Zona visible de nuevo"
        );
        onSaved();
      } else {
        toast.error(result.error ?? "Error al cambiar visibilidad");
      }
    });
  }

  function handleDeleteSubcategory(childId: string, childName: string) {
    startTransition(async () => {
      const result = await deleteCategory(childId);
      if (result.success) {
        toast.success(`"${childName}" eliminada`);
        onSaved();
      } else {
        toast.error(result.error ?? "Error al eliminar subcategoría");
      }
    });
  }

  const color = editState.color;
  const displayName = isEditing
    ? editState.name
    : (zone.name_es ?? zone.name);

  // ── Expanded (editing) ──────────────────────────────────────────────────

  if (isEditing) {
    return (
      <div
        className={cn(
          "col-span-1 sm:col-span-2 xl:col-span-3",
          "rounded-xl p-4 transition-all"
        )}
        style={{
          backgroundColor: zoneBackground(color),
          borderWidth: "1px",
          borderColor: zoneBorder(color),
        }}
      >
        {/* Editable header */}
        <div className="space-y-4">
          {/* Name input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Nombre
            </label>
            <Input
              value={editState.name}
              onChange={(e) =>
                setEditState((s) => ({ ...s, name: e.target.value }))
              }
              className="h-9 text-sm"
              placeholder="Nombre de la zona"
            />
          </div>

          {/* Icon picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Ícono
            </label>
            <IconPicker
              value={editState.icon}
              onValueChange={(icon) =>
                setEditState((s) => ({ ...s, icon }))
              }
            />
          </div>

          {/* Color picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Color
            </label>
            <ColorPicker
              value={editState.color}
              onValueChange={(c) =>
                setEditState((s) => ({ ...s, color: c }))
              }
            />
          </div>

          {/* Subcategory list with drag handles + delete */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">
              Subcategorías ({zone.children.length})
            </label>
            {zone.children.length > 0 ? (
              <ul className="space-y-1">
                {zone.children.map((child) => (
                  <li
                    key={child.id}
                    className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-black/5 dark:hover:bg-white/5"
                  >
                    <GripVertical className="size-3.5 text-muted-foreground/50 shrink-0" />
                    <span className="truncate flex-1">
                      {child.name_es ?? child.name}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() =>
                        handleDeleteSubcategory(
                          child.id,
                          child.name_es ?? child.name
                        )
                      }
                      disabled={isPending}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground py-2">
                Sin subcategorías aún
              </p>
            )}
          </div>

          {/* Inline form to add subcategories */}
          <InlineCategoryForm
            parentId={zone.id}
            direction={zone.direction}
            parentColor={editState.color}
            parentIcon={editState.icon}
            placeholder="Nueva subcategoría..."
            onCreated={() => onSaved()}
          />

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onCancelEdit}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={isPending || !editState.name.trim()}
            >
              {isPending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Collapsed (view) ────────────────────────────────────────────────────

  return (
    <div
      className={cn(
        "rounded-xl p-3 transition-all",
        !zone.is_active && "opacity-50"
      )}
      style={{
        backgroundColor: zoneBackground(zone.color),
        borderWidth: "1px",
        borderColor: zoneBorder(zone.color),
      }}
    >
      {/* Zone header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{zone.icon}</span>
        <span
          className="text-sm font-semibold truncate"
          style={{ color: zoneTextColor(zone.color) }}
        >
          {displayName}
        </span>

        {/* Badges */}
        <div className="flex items-center gap-1 shrink-0">
          {zone.is_essential && (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              Esencial
            </Badge>
          )}
          {!zone.is_active && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
              Oculta
            </Badge>
          )}
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 text-muted-foreground"
          >
            {zone.direction === "OUTFLOW" ? "Gasto" : "Ingreso"}
          </Badge>
        </div>

        {/* Child count */}
        <span className="ml-auto text-[11px] text-muted-foreground tabular-nums">
          {zone.children.length}
        </span>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleToggleActive}
            disabled={isPending}
            title={zone.is_active ? "Ocultar zona" : "Mostrar zona"}
          >
            {zone.is_active ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onStartEdit}
            disabled={isPending}
            title="Editar zona"
          >
            <Pencil className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Subcategory chip cloud */}
      {zone.children.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {zone.children.map((child) => (
            <SubcategoryChip
              key={child.id}
              name={child.name_es ?? child.name}
              icon={child.icon ?? undefined}
              color={zone.color}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── NewZoneTile ─────────────────────────────────────────────────────────────

function NewZoneTile({ onCreated }: { onCreated: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState("🎯");
  const [color, setColor] = useState("#3b82f6");
  const [isPending, startTransition] = useTransition();

  function reset() {
    setName("");
    setIcon("🎯");
    setColor("#3b82f6");
    setIsOpen(false);
  }

  function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) return;

    const formData = new FormData();
    formData.append("name", trimmed);
    formData.append("name_es", trimmed);
    formData.append("slug", generateSlug(trimmed));
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
        toast.success(`Zona "${trimmed}" creada`);
        reset();
        onCreated();
      } else {
        toast.error(result.error ?? "Error al crear zona");
      }
    });
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/20 p-6 text-muted-foreground transition-colors hover:border-muted-foreground/40 hover:text-foreground"
      >
        <Plus className="size-6" />
        <span className="text-sm font-medium">Nueva zona</span>
      </button>
    );
  }

  return (
    <div
      className="col-span-1 sm:col-span-2 xl:col-span-3 rounded-xl border-2 border-dashed border-primary/30 p-4 space-y-4"
    >
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Nombre
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
          }}
          className="h-9 text-sm"
          placeholder="Nombre de la nueva zona"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Ícono
        </label>
        <IconPicker value={icon} onValueChange={setIcon} />
      </div>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Color
        </label>
        <ColorPicker value={color} onValueChange={setColor} />
      </div>

      <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/40">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={reset}
          disabled={isPending}
        >
          Cancelar
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={handleCreate}
          disabled={isPending || !name.trim()}
        >
          {isPending ? "Creando..." : "Crear"}
        </Button>
      </div>
    </div>
  );
}

// ─── CategoryZoneManager (main) ──────────────────────────────────────────────

export function CategoryZoneManager({ categories }: CategoryZoneManagerProps) {
  const [localCategories, setLocalCategories] = useState(categories);
  const [editingZoneId, setEditingZoneId] = useState<string | null>(null);

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  function handleSaved() {
    // Reset editing state — server revalidation will update categories via props
    setEditingZoneId(null);
  }

  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
      {localCategories.map((zone) => (
        <ZoneCard
          key={zone.id}
          zone={zone}
          isEditing={editingZoneId === zone.id}
          onStartEdit={() => setEditingZoneId(zone.id)}
          onCancelEdit={() => setEditingZoneId(null)}
          onSaved={handleSaved}
        />
      ))}
      <NewZoneTile onCreated={() => setEditingZoneId(null)} />
    </div>
  );
}
