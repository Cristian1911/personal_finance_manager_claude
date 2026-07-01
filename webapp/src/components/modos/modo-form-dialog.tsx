"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DatePicker } from "@/components/ui/date-picker";
import { useAllTags } from "@/components/providers/app-data-provider";
import { createModo, updateModo } from "@/actions/modos";
import { BRASS_BUTTON_CLASS, chipToggleClass } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import type { Modo } from "@/types/domain";

interface ModoFormDialogProps {
  initial?: Partial<Modo> & { id?: string };
  trigger: ReactNode;
  presetTagIds?: string[];
  presetDateFrom?: string;
  presetDateTo?: string;
}

export function ModoFormDialog({
  initial,
  trigger,
  presetTagIds,
  presetDateFrom,
  presetDateTo,
}: ModoFormDialogProps) {
  const router = useRouter();
  const tags = useAllTags();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState(initial?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "");
  const [color, setColor] = useState(initial?.color ?? "#8a6d3b");
  const [dateFrom, setDateFrom] = useState(initial?.date_from ?? presetDateFrom ?? "");
  const [dateTo, setDateTo] = useState(initial?.date_to ?? presetDateTo ?? "");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(
    initial?.tag_ids ?? presetTagIds ?? []
  );

  function toggleTag(id: string) {
    setSelectedTagIds((cur) =>
      cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id]
    );
  }

  function submit() {
    setError(null);
    const fd = new FormData();
    fd.set("name", name);
    fd.set("emoji", emoji);
    fd.set("color", color);
    fd.set("date_from", dateFrom);
    fd.set("date_to", dateTo);
    fd.set("tag_ids", JSON.stringify(selectedTagIds));

    startTransition(async () => {
      const res = initial?.id
        ? await updateModo(initial.id, fd)
        : await createModo(fd);
      if (!res.success) {
        setError(res.error);
        return;
      }
      setOpen(false);
      if (initial?.id) {
        router.refresh();
      } else if (res.data) {
        router.push(`/modos/${res.data.id}`);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial?.id ? "Editar modo" : "Nuevo modo"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="modo-name">Nombre</Label>
            <Input
              id="modo-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cartagena, Boda de Ana..."
            />
          </div>

          <div className="flex gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="modo-emoji">Emoji</Label>
              <Input
                id="modo-emoji"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                placeholder="📍"
                className="w-20"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="modo-color">Color</Label>
              {/* ponytail: native color input for an optional accent; swap to token swatches if design wants presets */}
              <input
                id="modo-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-9 w-16 cursor-pointer rounded-md border border-white/6 bg-transparent"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label>Desde</Label>
              <DatePicker value={dateFrom || null} onChange={(v) => setDateFrom(v ?? "")} />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>Hasta</Label>
              <DatePicker value={dateTo || null} onChange={(v) => setDateTo(v ?? "")} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Etiquetas</Label>
            {tags.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tienes etiquetas todavía.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      aria-pressed={selected}
                      className={chipToggleClass(selected)}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className={cn(BRASS_BUTTON_CLASS, "disabled:opacity-60")}
          >
            {pending ? "Guardando..." : initial?.id ? "Guardar cambios" : "Crear modo"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
