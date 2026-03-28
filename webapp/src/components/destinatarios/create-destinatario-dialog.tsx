"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createDestinatario } from "@/actions/destinatarios";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ActionResult } from "@/types/actions";
import type { CategoryWithChildren } from "@/types/domain";
import type { Database } from "@/types/database";

type Destinatario = Database["public"]["Tables"]["destinatarios"]["Row"];

export function CreateDestinatarioDialog({
  categories,
  trigger,
}: {
  categories: CategoryWithChildren[];
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("none");
  const [isActive, setIsActive] = useState(true);
  const [state, formAction, pending] = useActionState<ActionResult<Destinatario>, FormData>(
    createDestinatario,
    { success: false, error: "" }
  );

  const categoryOptions = useMemo(
    () =>
      categories.flatMap((category) => [
        {
          id: category.id,
          label: category.name_es ?? category.name,
        },
        ...category.children.map((child) => ({
          id: child.id,
          label: `${category.name_es ?? category.name} / ${child.name_es ?? child.name}`,
        })),
      ]),
    [categories]
  );

  useEffect(() => {
    if (!state.success) return;
    router.refresh();
    setOpen(false);
    setCategoryId("none");
    setIsActive(true);
  }, [router, state.success]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4 mr-2" />
            Crear destinatario
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear destinatario</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {!state.success && state.error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="dest-name">Nombre</Label>
            <Input
              id="dest-name"
              name="name"
              placeholder="Ej: Nequi, Spotify, Rappi"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dest-category">Categoría por defecto</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger id="dest-category">
                <SelectValue placeholder="Sin categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin categoría</SelectItem>
                {categoryOptions.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input
              type="hidden"
              name="default_category_id"
              value={categoryId === "none" ? "" : categoryId}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dest-patterns">Patrones</Label>
            <Input
              id="dest-patterns"
              name="patterns"
              placeholder="Ej: nequi pago, rappi, spotify"
            />
            <p className="text-xs text-muted-foreground">
              Separa varios patrones con comas para crear reglas iniciales de asociación.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="dest-notes">Notas</Label>
            <Input
              id="dest-notes"
              name="notes"
              placeholder="Contexto opcional para este destinatario"
            />
          </div>

          <input type="hidden" name="is_active" value={isActive ? "true" : "false"} />

          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              onClick={() => setIsActive((current) => !current)}
            >
              {isActive ? "Crear activo" : "Crear inactivo"}
            </button>
            <Button type="submit" className="bg-z-brass text-z-ink hover:bg-z-brass/90" disabled={pending}>
              {pending ? "Creando..." : "Guardar destinatario"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
