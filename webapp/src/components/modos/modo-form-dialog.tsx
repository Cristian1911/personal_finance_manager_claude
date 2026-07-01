"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { DestinatarioZonePicker } from "@/components/destinatarios/destinatario-zone-picker";
import { useAllTags } from "@/components/providers/app-data-provider";
import { createModo, updateModo } from "@/actions/modos";
import {
  BRASS_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  ICON_DESTRUCTIVE_TRIGGER_CLASS,
  chipToggleClass,
} from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import type { Modo } from "@/types/domain";

type ParticipantRow = { key: string; destinatarioId: string | null; name: string; value: string };

interface ModoFormDialogProps {
  initial?: Partial<Modo> & { id?: string };
  initialParticipants?: { destinatario_id: string; value: number | null; name?: string }[];
  trigger: ReactNode;
  presetTagIds?: string[];
  presetDateFrom?: string;
  presetDateTo?: string;
}

export function ModoFormDialog({
  initial,
  initialParticipants,
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
  const [isShared, setIsShared] = useState(initial?.is_shared ?? false);
  const [splitMethod, setSplitMethod] = useState<"equal" | "percent">(
    (initial?.split_method as "equal" | "percent") ?? "equal"
  );
  const [userIncluded, setUserIncluded] = useState(initial?.user_included ?? true);
  const [participants, setParticipants] = useState<ParticipantRow[]>(
    (initialParticipants ?? []).map((p) => ({
      key: crypto.randomUUID(),
      destinatarioId: p.destinatario_id,
      name: p.name ?? "",
      value: p.value != null ? String(p.value) : "",
    }))
  );

  // The dialog stays mounted while closed, so useState initializers only run
  // once. Reset local state when it closes so stale values (or changed presets)
  // don't leak into the next open — including the compartido config.
  useEffect(() => {
    if (!open) {
      setName(initial?.name ?? "");
      setEmoji(initial?.emoji ?? "");
      setColor(initial?.color ?? "#8a6d3b");
      setDateFrom(initial?.date_from ?? presetDateFrom ?? "");
      setDateTo(initial?.date_to ?? presetDateTo ?? "");
      setSelectedTagIds(initial?.tag_ids ?? presetTagIds ?? []);
      setIsShared(initial?.is_shared ?? false);
      setSplitMethod((initial?.split_method as "equal" | "percent") ?? "equal");
      setUserIncluded(initial?.user_included ?? true);
      setParticipants(
        (initialParticipants ?? []).map((p) => ({
          key: crypto.randomUUID(),
          destinatarioId: p.destinatario_id,
          name: p.name ?? "",
          value: p.value != null ? String(p.value) : "",
        })),
      );
      setError(null);
    }
  }, [open, initial, initialParticipants, presetTagIds, presetDateFrom, presetDateTo]);

  function toggleTag(id: string) {
    setSelectedTagIds((cur) =>
      cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id]
    );
  }

  function addParticipant() {
    setParticipants((cur) => [...cur, { key: crypto.randomUUID(), destinatarioId: null, name: "", value: "" }]);
  }
  function updateParticipant(key: string, patch: Partial<ParticipantRow>) {
    setParticipants((cur) => cur.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }
  function removeParticipant(key: string) {
    setParticipants((cur) => cur.filter((p) => p.key !== key));
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
    fd.set("is_shared", String(isShared));
    fd.set("split_method", splitMethod);
    fd.set("user_included", String(userIncluded));
    const validParticipants = participants
      .filter((p) => p.destinatarioId)
      .map((p) => ({
        destinatario_id: p.destinatarioId as string,
        value: splitMethod === "percent" && p.value.trim() !== "" ? Number(p.value) : undefined,
      }));
    fd.set("participants", JSON.stringify(isShared ? validParticipants : []));

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

          {/* Compartir gastos */}
          <div className="space-y-3 rounded-xl border border-white/6 bg-z-surface-2 p-3">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={isShared}
                onCheckedChange={(v) => setIsShared(v === true)}
              />
              Compartir gastos de este modo
            </label>

            {isShared && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Personas</Label>
                  {participants.map((p) => (
                    <div key={p.key} className="flex items-start gap-2">
                      <div className="flex-1">
                        <DestinatarioZonePicker
                          value={p.destinatarioId}
                          onValueChange={(id, personName) =>
                            updateParticipant(p.key, { destinatarioId: id, name: personName ?? "" })
                          }
                          selectedName={p.name}
                          placeholder="Elegir o crear persona"
                          triggerClassName="w-full"
                          kindFilter={["person"]}
                          createKind="person"
                          variant="dialog"
                        />
                      </div>
                      {splitMethod === "percent" && (
                        <div className="relative w-20 shrink-0">
                          <Input
                            inputMode="decimal"
                            value={p.value}
                            onChange={(e) => updateParticipant(p.key, { value: e.target.value })}
                            placeholder="0"
                            className="pr-6 text-right tabular-nums"
                          />
                          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                            %
                          </span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeParticipant(p.key)}
                        aria-label="Quitar persona"
                        className={cn(ICON_DESTRUCTIVE_TRIGGER_CLASS, "mt-1 shrink-0 p-1.5")}
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  ))}
                  <Button type="button" variant="ghost" onClick={addParticipant} className={GHOST_BUTTON_CLASS}>
                    + Agregar persona
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <Label>Reparto</Label>
                  <div className="flex gap-2">
                    {(["equal", "percent"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSplitMethod(m)}
                        aria-pressed={splitMethod === m}
                        className={chipToggleClass(splitMethod === m)}
                      >
                        {m === "equal" ? "Partes iguales" : "Porcentaje"}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={userIncluded}
                    onCheckedChange={(v) => setUserIncluded(v === true)}
                  />
                  Incluirme en el reparto
                </label>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button
            type="button"
            onClick={submit}
            disabled={pending}
            className={cn(BRASS_BUTTON_CLASS, "disabled:opacity-60")}
          >
            {pending ? "Guardando..." : initial?.id ? "Guardar cambios" : "Crear modo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
