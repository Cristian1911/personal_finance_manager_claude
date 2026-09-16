"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  nextSaturday,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { MobileHeader } from "@/components/mobile/v2/mobile-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { IconPicker } from "@/components/categories/icon-picker";
import { ColorPicker } from "@/components/categories/color-picker";
import { DestinatarioZonePicker } from "@/components/destinatarios/destinatario-zone-picker";
import { TagZonePicker } from "@/components/tags/tag-zone-picker";
import { TagChip } from "@/components/tags/tag-chip";
import { WizardActionBar } from "@/components/import/wizard-action-bar";
import { ModoCandidateList } from "@/components/modos/modo-candidate-list";
import { useAllTags } from "@/components/providers/app-data-provider";
import { createModo, getModoCandidates, updateModo, type ModoCandidateRow } from "@/actions/modos";
import { cn } from "@/lib/utils";
import { toColombiaDateString } from "@/lib/utils/date";
import {
  BRASS_BUTTON_CLASS,
  DESTRUCTIVE_GHOST_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  ICON_DESTRUCTIVE_TRIGGER_CLASS,
  PANEL_INSET_CLASS,
  PANEL_SURFACE_CLASS,
  chipToggleClass,
} from "@/lib/constants/styles";
import type { Modo, ModoParticipant } from "@/types/domain";

// ── Constants ──────────────────────────────────────────────────────────────
const TRIP_ICONS = [
  "✈️", "🏖️", "🏔️", "🗺️", "🚗", "🚌", "🚢", "🏕️", "🎒", "🌎", "🗽", "🏝️", "⛷️", "🎡",
  "🎉", "🎂", "💍", "🎓", "🏟️", "🎶", "🍷", "🛍️", "🏠", "👶", "🎄", "🎃", "❤️", "📍",
] as const;
const TRIP_COLORS = [
  "#8a6d3b", "#c9a961", "#0ea5e9", "#3b82f6", "#22c55e", "#14b8a6", "#f97316", "#ef4444",
  "#ec4899", "#a855f7", "#6366f1", "#eab308", "#84cc16", "#06b6d4", "#f59e0b", "#94a3b8",
] as const;

type DatePreset = "weekend" | "week" | "month" | "custom";
const DATE_PRESETS: { id: DatePreset; label: string }[] = [
  { id: "weekend", label: "Fin de semana" },
  { id: "week", label: "Esta semana" },
  { id: "month", label: "Este mes" },
  { id: "custom", label: "Personalizado" },
];

function presetRange(preset: DatePreset, todayIso: string): { from: string; to: string } | null {
  const today = parseISO(todayIso);
  const fmt = (d: Date) => format(d, "yyyy-MM-dd");
  switch (preset) {
    case "weekend": {
      const sat = today.getDay() === 6 ? today : today.getDay() === 0 ? addDays(today, -1) : nextSaturday(today);
      return { from: fmt(sat), to: fmt(addDays(sat, 1)) };
    }
    case "week":
      return { from: fmt(startOfWeek(today, { weekStartsOn: 1 })), to: fmt(endOfWeek(today, { weekStartsOn: 1 })) };
    case "month":
      return { from: fmt(startOfMonth(today)), to: fmt(endOfMonth(today)) };
    default:
      return null;
  }
}

type ParticipantRow = { key: string; destinatarioId: string | null; name: string; value: string };
type Step = 1 | 2 | 3;
const STEP_TITLES: Record<Step, string> = {
  1: "¿Qué y cuándo?",
  2: "¿Con quién?",
  3: "¿Qué entra?",
};

export interface ModoWizardProps {
  mode: "create" | "edit";
  initial?: Modo;
  initialParticipants?: (ModoParticipant & { name?: string })[];
  presets?: { name?: string; tagIds?: string[]; dateFrom?: string; dateTo?: string; step?: number };
  /** Called right before navigating away after a successful save. */
  onDone?: () => void;
  /** Called right before navigating away when the user abandons the wizard. */
  onLeave?: () => void;
}

/**
 * Full-screen, three-step creation/edit flow for a viaje/evento. Replaces the
 * single overflowing dialog: focus mode (tab bar hidden by route), a dirty
 * guard on "Salir", a pinned action bar, and — on create — the range's
 * candidate transactions so the trip starts populated instead of empty.
 */
export function ModoWizard({ mode, initial, initialParticipants = [], presets, onDone, onLeave }: ModoWizardProps) {
  const router = useRouter();
  const allTags = useAllTags();
  const isEdit = mode === "edit";
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState("");
  useEffect(() => {
    // Wall clock is external state — read once after mount to keep hydration stable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(toColombiaDateString(new Date()));
  }, []);

  // ── Step ────────────────────────────────────────────────────────────────
  const initialStep = presets?.step === 2 || presets?.step === 3 ? (presets.step as Step) : 1;
  const [step, setStep] = useState<Step>(initialStep);

  // ── Step 1 ──────────────────────────────────────────────────────────────
  const [name, setName] = useState(initial?.name ?? presets?.name ?? "");
  const [emoji, setEmoji] = useState(initial?.emoji ?? "✈️");
  const [color, setColor] = useState(initial?.color ?? TRIP_COLORS[0]);
  const [dateFrom, setDateFrom] = useState(initial?.date_from ?? presets?.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(initial?.date_to ?? presets?.dateTo ?? "");
  const [datePreset, setDatePreset] = useState<DatePreset>("custom");

  // ── Step 2 ──────────────────────────────────────────────────────────────
  const [isShared, setIsShared] = useState(initial?.is_shared ?? false);
  const [splitMethod, setSplitMethod] = useState<"equal" | "percent">(
    (initial?.split_method as "equal" | "percent") ?? "equal",
  );
  const [userIncluded, setUserIncluded] = useState(initial?.user_included ?? true);
  const [participants, setParticipants] = useState<ParticipantRow[]>(() =>
    initialParticipants.map((p) => ({
      key: crypto.randomUUID(),
      destinatarioId: p.destinatario_id,
      name: p.name ?? "",
      value: p.share_value != null ? String(p.share_value) : "",
    })),
  );

  // ── Step 3 ──────────────────────────────────────────────────────────────
  const presetTagIds = presets?.tagIds ?? [];
  const [tagMode, setTagMode] = useState<"new" | "existing">(
    isEdit || presetTagIds.length > 0 ? "existing" : "new",
  );
  const [existingTagIds, setExistingTagIds] = useState<string[]>(initial?.tag_ids ?? presetTagIds);
  const [tagPickerOpen, setTagPickerOpen] = useState(false);
  // "Estoy en este viaje" follows the calendar until the user flips it.
  const [activeChoice, setActiveChoice] = useState<boolean | null>(null);
  const rangeValid = !!dateFrom && !!dateTo && dateFrom <= dateTo;
  const todayInRange = rangeValid && !!today && today >= dateFrom && today <= dateTo;
  const isActive = activeChoice ?? (!isEdit && todayInRange);

  // Candidates for the range (create only): the preview count on step 1 and
  // the checklist on step 3 come from the same cached read.
  const [fetched, setFetched] = useState<{ key: string; rows: ModoCandidateRow[] } | null>(null);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [selectedCandidates, setSelectedCandidates] = useState<Set<string>>(new Set());
  const [rejectedCandidates, setRejectedCandidates] = useState<Set<string>>(new Set());
  const candidatesKey = `${dateFrom}|${dateTo}|${tagMode === "existing" ? existingTagIds.join(",") : ""}`;
  const requested = useRef<string>("");
  useEffect(() => {
    if (isEdit || !rangeValid || requested.current === candidatesKey) return;
    const key = candidatesKey;
    const handle = setTimeout(() => {
      requested.current = key;
      setCandidatesLoading(true);
      getModoCandidates({
        date_from: dateFrom,
        date_to: dateTo,
        tag_ids: tagMode === "existing" ? existingTagIds : [],
      }).then((res) => {
        setCandidatesLoading(false);
        if (!res.success) return;
        setFetched({ key, rows: res.data });
        // Foreign-currency rows are almost certainly the trip — pre-tick them.
        setSelectedCandidates(new Set(res.data.filter((r) => r.candidate.foreignCurrency).map((r) => r.id)));
      });
    }, 300);
    return () => clearTimeout(handle);
  }, [isEdit, rangeValid, candidatesKey, dateFrom, dateTo, tagMode, existingTagIds]);
  // Only rows fetched for the CURRENT range count; a stale range shows nothing.
  const candidates = rangeValid && fetched?.key === candidatesKey ? fetched.rows : null;

  // ── Dirty guard ─────────────────────────────────────────────────────────
  const dirty =
    !isEdit &&
    (name.trim() !== (presets?.name ?? "") || !!dateFrom || !!dateTo || participants.length > 0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  const backHref = isEdit && initial ? `/modos/${initial.id}` : "/modos";
  // `replace`, never `push`: a wizard — finished or abandoned — must not stay
  // in the history, or the phone's back button lands on it again with its
  // React state restored from the Router Cache (see #387).
  function leave() {
    onLeave?.();
    router.replace(backHref);
  }
  function handleBack() {
    if (dirty && !pending) setConfirmOpen(true);
    else leave();
  }

  // ── Validation per step ─────────────────────────────────────────────────
  const step1Error = !name.trim()
    ? "Ponle un nombre al viaje o evento"
    : !dateFrom || !dateTo
      ? "Elige desde y hasta cuándo"
      : dateFrom > dateTo
        ? "La fecha final no puede ser anterior a la inicial"
        : null;
  const validParticipants = participants.filter((p) => p.destinatarioId);
  const step2Error = isShared
    ? validParticipants.length === 0
      ? "Agrega al menos una persona"
      : splitMethod === "percent" && validParticipants.some((p) => p.value.trim() === "")
        ? "Indica el porcentaje de cada persona"
        : null
    : null;
  const step3Error = tagMode === "existing" && existingTagIds.length === 0
    ? "Elige al menos una etiqueta o crea una nueva"
    : null;

  function next() {
    setError(null);
    const err = step === 1 ? step1Error : step === 2 ? step2Error : null;
    if (err) {
      setError(err);
      return;
    }
    setStep((s) => (s < 3 ? ((s + 1) as Step) : s));
  }
  function back() {
    setError(null);
    setStep((s) => (s > 1 ? ((s - 1) as Step) : s));
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  function submit() {
    setError(null);
    const err = step1Error ?? step2Error ?? step3Error;
    if (err) {
      setError(err);
      return;
    }
    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("emoji", emoji);
    fd.set("color", color);
    fd.set("date_from", dateFrom);
    fd.set("date_to", dateTo);
    fd.set("tag_ids", JSON.stringify(tagMode === "existing" ? existingTagIds : []));
    fd.set("create_tag", String(tagMode === "new"));
    if (tagMode === "existing") {
      // The trip's own tag = the one it auto-attaches. Keep the current one on
      // edit when it is still selected; otherwise the first chosen tag.
      const keep = initial?.auto_tag_id && existingTagIds.includes(initial.auto_tag_id);
      fd.set("auto_tag_id", keep ? initial!.auto_tag_id! : existingTagIds[0]);
    }
    fd.set("is_active", String(!isEdit && isActive));
    fd.set("is_shared", String(isShared));
    fd.set("split_method", splitMethod);
    fd.set("user_included", String(userIncluded));
    fd.set(
      "participants",
      JSON.stringify(
        isShared
          ? validParticipants.map((p) => ({
              destinatario_id: p.destinatarioId as string,
              value: splitMethod === "percent" && p.value.trim() !== "" ? Number(p.value) : undefined,
            }))
          : [],
      ),
    );
    if (!isEdit && selectedCandidates.size > 0) {
      fd.set("include_tx_ids", JSON.stringify([...selectedCandidates].filter((id) => !rejectedCandidates.has(id))));
    }
    if (!isEdit && rejectedCandidates.size > 0) {
      fd.set("exclude_tx_ids", JSON.stringify([...rejectedCandidates]));
    }

    startTransition(async () => {
      const res = isEdit && initial ? await updateModo(initial.id, fd) : await createModo(fd);
      if (!res.success) {
        setError(res.error);
        return;
      }
      onDone?.();
      if (isEdit && initial) {
        toast.success("Viaje actualizado");
        router.replace(`/modos/${initial.id}`);
        router.refresh();
      } else if (res.data) {
        const n = selectedCandidates.size;
        toast.success(n > 0 ? `Viaje creado con ${n} ${n === 1 ? "gasto" : "gastos"}` : "Viaje creado");
        router.replace(`/modos/${res.data.id}`);
      }
    });
  }

  // ── Participants helpers ────────────────────────────────────────────────
  function addParticipant() {
    setParticipants((cur) => [...cur, { key: crypto.randomUUID(), destinatarioId: null, name: "", value: "" }]);
  }
  function updateParticipant(key: string, patch: Partial<ParticipantRow>) {
    setParticipants((cur) => cur.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }
  function removeParticipant(key: string) {
    setParticipants((cur) => cur.filter((p) => p.key !== key));
  }

  const selectedExistingTags = useMemo(
    () => allTags.filter((t) => existingTagIds.includes(t.id)),
    [allTags, existingTagIds],
  );
  const candidateCount = candidates?.length ?? 0;
  const title = isEdit ? "Editar viaje" : "Nuevo viaje o evento";

  return (
    <div className="pb-28 lg:pb-0">
      <MobileHeader variant="sub" title={title} backHref={backHref} backStyle="exit" onBackClick={handleBack} />

      <div className="mx-auto w-full max-w-2xl space-y-6 px-4 pt-4 lg:pt-0">
        {/* Desktop header */}
        <div className="hidden lg:block">
          <SectionEyebrow>Viajes y eventos</SectionEyebrow>
          <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {([1, 2, 3] as Step[]).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => s < step && setStep(s)}
              aria-label={`Paso ${s}`}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors",
                s === step ? "bg-z-brass" : s < step ? "bg-z-brass/50" : "bg-white/6",
              )}
            />
          ))}
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Paso {step} de 3</p>
          <h2 className="text-xl font-semibold tracking-tight">{STEP_TITLES[step]}</h2>
        </div>

        {/* ── Step 1 ── */}
        {step === 1 && (
          <section className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="modo-name">Nombre</Label>
              <Input
                id="modo-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Argentina con Estefa, Boda de Ana…"
                className="h-11 text-base"
              />
            </div>

            <div className={cn(PANEL_INSET_CLASS, "space-y-4 p-3")}>
              <div className="flex items-center gap-3">
                <span
                  className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-2xl"
                  style={{ backgroundColor: `${color}26`, boxShadow: `inset 0 0 0 1px ${color}66` }}
                  aria-hidden
                >
                  {emoji}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium">{name.trim() || "Tu viaje"}</p>
                  <p className="text-xs text-muted-foreground">Así se verá en la lista y en Movimientos</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Emoji</Label>
                <IconPicker value={emoji} onValueChange={setEmoji} icons={TRIP_ICONS} />
              </div>
              <div className="space-y-1.5">
                <Label>Color</Label>
                <ColorPicker value={color} onValueChange={setColor} colors={TRIP_COLORS} />
              </div>
            </div>

            <div className="space-y-3">
              <Label>Fechas</Label>
              <div className="flex flex-wrap gap-1.5">
                {DATE_PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    disabled={!today && p.id !== "custom"}
                    aria-pressed={datePreset === p.id}
                    onClick={() => {
                      setDatePreset(p.id);
                      const r = today ? presetRange(p.id, today) : null;
                      if (r) {
                        setDateFrom(r.from);
                        setDateTo(r.to);
                      }
                    }}
                    className={chipToggleClass(datePreset === p.id)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Desde</Label>
                  <DatePicker
                    value={dateFrom || null}
                    onChange={(v) => {
                      setDatePreset("custom");
                      setDateFrom(v ?? "");
                    }}
                    className="w-full"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Hasta</Label>
                  <DatePicker
                    value={dateTo || null}
                    onChange={(v) => {
                      setDatePreset("custom");
                      setDateTo(v ?? "");
                    }}
                    className="w-full"
                  />
                </div>
              </div>
              {rangeValid && !isEdit && (
                <p className="text-sm text-muted-foreground">
                  {candidatesLoading && candidates === null
                    ? "Buscando movimientos en estas fechas…"
                    : candidateCount > 0
                      ? `${candidateCount} ${candidateCount === 1 ? "movimiento" : "movimientos"} en estas fechas podrían ser del viaje. Los eliges en el paso 3.`
                      : "Aún no hay movimientos en estas fechas. Lo que registres se irá sumando."}
                </p>
              )}
              {dateFrom && dateTo && dateFrom > dateTo && (
                <p className="text-sm text-destructive">La fecha final no puede ser anterior a la inicial</p>
              )}
            </div>
          </section>
        )}

        {/* ── Step 2 ── */}
        {step === 2 && (
          <section className="space-y-5">
            <label className={cn(PANEL_SURFACE_CLASS, "flex cursor-pointer items-center justify-between gap-4 p-4")}>
              <span>
                <span className="block font-medium">Comparto los gastos</span>
                <span className="block text-sm text-muted-foreground">
                  Después eliges qué gastos se reparten; los demás quedan como tuyos. Zeta lleva la cuenta de lo que
                  te deben.
                </span>
              </span>
              <Switch checked={isShared} onCheckedChange={setIsShared} aria-label="Comparto los gastos" />
            </label>

            {isShared && (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label>Personas</Label>
                  {participants.length === 0 && (
                    <p className="text-sm text-muted-foreground">¿Con quién repartes? Agrega una o más personas.</p>
                  )}
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
                            aria-label="Porcentaje"
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
                    <Plus className="size-4" />
                    Agregar persona
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
                  {splitMethod === "percent" && (
                    <p className="text-xs text-muted-foreground">
                      Los porcentajes son de las otras personas; si te incluyes, tú tomas el resto.
                    </p>
                  )}
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={userIncluded} onCheckedChange={(v) => setUserIncluded(v === true)} />
                  Incluirme en el reparto
                </label>
              </div>
            )}
          </section>
        )}

        {/* ── Step 3 ── */}
        {step === 3 && (
          <section className="space-y-5">
            <div className="space-y-2">
              <Label>Etiqueta del viaje</Label>
              <p className="text-sm text-muted-foreground">
                Todo lo que lleve esta etiqueta cuenta como gasto del viaje, también lo pagado antes o después de
                las fechas (vuelos, hotel). Las fechas solo deciden qué se etiqueta solo y qué te propongo revisar.
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setTagMode("new")}
                  aria-pressed={tagMode === "new"}
                  className={chipToggleClass(tagMode === "new")}
                  disabled={isEdit && !!initial?.auto_tag_id}
                >
                  Crear #{name.trim() || "viaje"}
                </button>
                <button
                  type="button"
                  onClick={() => setTagMode("existing")}
                  aria-pressed={tagMode === "existing"}
                  className={chipToggleClass(tagMode === "existing")}
                >
                  Usar etiquetas que ya tengo
                </button>
              </div>
              {tagMode === "existing" && (
                <div className={cn(PANEL_INSET_CLASS, "space-y-2 p-3")}>
                  {selectedExistingTags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {selectedExistingTags.map((t) => (
                        <TagChip
                          key={t.id}
                          tag={t}
                          size="sm"
                          onRemove={() => setExistingTagIds((cur) => cur.filter((id) => id !== t.id))}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Ninguna etiqueta elegida.</p>
                  )}
                  <Button type="button" variant="ghost" className={GHOST_BUTTON_CLASS} onClick={() => setTagPickerOpen(true)}>
                    <Plus className="size-4" />
                    Elegir etiquetas
                  </Button>
                  <TagZonePicker
                    selectedTagIds={existingTagIds}
                    onSelectedTagIdsChange={setExistingTagIds}
                    hideTrigger
                    controlledOpen={tagPickerOpen}
                    onControlledOpenChange={setTagPickerOpen}
                  />
                </div>
              )}
            </div>

            {!isEdit && (
              <label className={cn(PANEL_SURFACE_CLASS, "flex cursor-pointer items-center justify-between gap-4 p-4")}>
                <span>
                  <span className="block font-medium">Estoy en este viaje ahora</span>
                  <span className="block text-sm text-muted-foreground">
                    Lo que registres a mano se etiqueta solo. Recurrentes, transferencias y deudas quedan
                    fuera. Lo importado te lo muestro para confirmar.
                  </span>
                </span>
                <Switch checked={isActive} onCheckedChange={setActiveChoice} aria-label="Estoy en este viaje ahora" />
              </label>
            )}

            {!isEdit && (
              <div className="space-y-2">
                <Label>Movimientos en estas fechas</Label>
                {candidatesLoading && candidates === null ? (
                  <p className="text-sm text-muted-foreground">Buscando…</p>
                ) : candidates && candidates.length > 0 ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Marca los que fueron del viaje; toca una fila para ver el detalle. Los de moneda extranjera ya vienen marcados.
                    </p>
                    <ModoCandidateList
                      rows={candidates}
                      selected={selectedCandidates}
                      rejected={rejectedCandidates}
                      onToggle={(id) =>
                        setSelectedCandidates((cur) => {
                          const n = new Set(cur);
                          if (n.has(id)) n.delete(id);
                          else {
                            n.add(id);
                            setRejectedCandidates((r) => {
                              const rr = new Set(r);
                              rr.delete(id);
                              return rr;
                            });
                          }
                          return n;
                        })
                      }
                      onAccept={(id) => {
                        setRejectedCandidates((r) => {
                          const rr = new Set(r);
                          rr.delete(id);
                          return rr;
                        });
                        setSelectedCandidates((cur) => new Set(cur).add(id));
                      }}
                      onReject={(id) => {
                        setSelectedCandidates((cur) => {
                          const n = new Set(cur);
                          n.delete(id);
                          return n;
                        });
                        setRejectedCandidates((r) => new Set(r).add(id));
                      }}
                      onToggleAll={(next) => {
                        if (next) setRejectedCandidates(new Set());
                        setSelectedCandidates(next ? new Set(candidates.map((r) => r.id)) : new Set());
                      }}
                      limit={60}
                    />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nada por ahora. Lo que registres en estas fechas irá apareciendo aquí.
                  </p>
                )}
              </div>
            )}

            {isEdit && initial && (
              <p className="text-sm text-muted-foreground">
                Los movimientos del rango que aún no están en el viaje se revisan desde el detalle
                (“Por revisar”).
              </p>
            )}
          </section>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <WizardActionBar className="lg:mx-auto lg:max-w-2xl lg:px-4">
        {step > 1 ? (
          <Button type="button" variant="ghost" onClick={back} disabled={pending} className={GHOST_BUTTON_CLASS}>
            Atrás
          </Button>
        ) : (
          <span />
        )}
        {step < 3 ? (
          <Button type="button" onClick={next} className={BRASS_BUTTON_CLASS}>
            Siguiente
          </Button>
        ) : (
          <Button type="button" onClick={submit} disabled={pending} className={cn(BRASS_BUTTON_CLASS, "disabled:opacity-60")}>
            <Check className="size-4" />
            {pending
              ? "Guardando…"
              : isEdit
                ? "Guardar cambios"
                : selectedCandidates.size > 0
                  ? `Crear viaje con ${selectedCandidates.size}`
                  : "Crear viaje"}
          </Button>
        )}
      </WizardActionBar>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Descartar este viaje?</AlertDialogTitle>
            <AlertDialogDescription>
              Aún no has guardado nada. Si sales ahora se pierde lo que llenaste.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Seguir editando</AlertDialogCancel>
            <AlertDialogAction
              variant="ghost"
              className={cn(DESTRUCTIVE_GHOST_BUTTON_CLASS)}
              onClick={() => {
                setConfirmOpen(false);
                leave();
              }}
            >
              Descartar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
