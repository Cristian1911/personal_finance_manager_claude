"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  Check,
  ChevronDown,
  Link2,
  Loader2,
  Plus,
  Search,
  Store,
  User,
  X,
} from "lucide-react";
import { cleanDescription } from "@zeta/shared";
import {
  createDestinatario,
  testDestinatarioPattern,
  type CreateDestinatarioResult,
  type PatternTestResult,
} from "@/actions/destinatarios";
import {
  useCategories,
  useDestinatarios,
} from "@/components/providers/app-data-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/types/actions";
import type { CurrencyCode } from "@/types/domain";

/**
 * Decision the user made for a suggested merchant during reconciliation. Applied
 * to this import batch's matching transactions before persistence.
 */
export type MerchantDecision = {
  destinatarioId: string;
  destinatarioName: string;
  /** default_category_id of a freshly-created destinatario, applied to uncategorized rows. */
  categoryId: string | null;
};

export function SuggestedDestinatariosPanel({
  merchantNames,
  matchCounts,
  decisions,
  onDecide,
  onClear,
}: {
  merchantNames: string[];
  matchCounts: Map<string, number>;
  decisions: Map<string, MerchantDecision>;
  onDecide: (name: string, decision: MerchantDecision) => void;
  onClear: (name: string) => void;
}) {
  return (
    <ul className="space-y-1.5">
      {merchantNames.map((name) => (
        <SuggestedMerchantRow
          key={`sug-${name}`}
          name={name}
          count={matchCounts.get(name) ?? 0}
          decision={decisions.get(name) ?? null}
          onDecide={(decision) => onDecide(name, decision)}
          onClear={() => onClear(name)}
        />
      ))}
    </ul>
  );
}

function SuggestedMerchantRow({
  name,
  count,
  decision,
  onDecide,
  onClear,
}: {
  name: string;
  count: number;
  decision: MerchantDecision | null;
  onDecide: (decision: MerchantDecision) => void;
  onClear: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const decided = decision !== null;

  return (
    <li
      className={cn(
        "overflow-hidden rounded-lg border bg-z-surface-2/40 transition-colors",
        decided ? "border-z-brass/30" : "border-white/6",
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-z-sage-light">{name}</p>
          {decided && (
            <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-z-brass">
              <Check className="h-3 w-3 shrink-0" />
              {decision.destinatarioName}
            </p>
          )}
        </div>
        {count > 0 && (
          <Badge variant="outline" className="shrink-0 tabular-nums text-[10px]">
            {count} mov
          </Badge>
        )}
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-z-sage-dark transition-transform",
            expanded && "rotate-180",
          )}
        />
      </button>

      {expanded && (
        <div className="border-t border-white/6 px-3 py-2.5">
          {decided ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-z-sage-dark">
                Se asignará a{" "}
                <span className="font-medium text-z-white">
                  {decision.destinatarioName}
                </span>{" "}
                en esta importación.
              </p>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 shrink-0 px-2 text-xs"
                onClick={onClear}
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Deshacer
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Crear destinatario
              </Button>

              <Popover open={linkOpen} onOpenChange={setLinkOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" size="sm" variant="outline">
                    <Link2 className="mr-1.5 h-3.5 w-3.5" />
                    Vincular a existente
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[240px] p-0" align="start">
                  <ExistingDestinatarioList
                    onSelect={(d) => {
                      setLinkOpen(false);
                      onDecide({
                        destinatarioId: d.id,
                        destinatarioName: d.name,
                        categoryId: null,
                      });
                    }}
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}
        </div>
      )}

      {createOpen && (
        <CreateFromMerchantDialog
          rawDescription={name}
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={(d) => {
            setCreateOpen(false);
            onDecide(d);
          }}
        />
      )}
    </li>
  );
}

function ExistingDestinatarioList({
  onSelect,
}: {
  onSelect: (d: { id: string; name: string }) => void;
}) {
  const destinatarios = useDestinatarios();
  const active = destinatarios.filter((d) => d.is_active);

  return (
    <Command>
      <CommandInput placeholder="Buscar destinatario..." />
      <CommandList>
        <CommandEmpty>Sin resultados.</CommandEmpty>
        <CommandGroup>
          {active.map((d) => (
            <CommandItem
              key={d.id}
              value={d.name}
              onSelect={() => onSelect({ id: d.id, name: d.name })}
            >
              {d.kind === "person" ? (
                <User className="mr-2 h-4 w-4 text-z-sage-dark" />
              ) : (
                <Store className="mr-2 h-4 w-4 text-z-sage-dark" />
              )}
              {d.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function CreateFromMerchantDialog({
  rawDescription,
  open,
  onOpenChange,
  onCreated,
}: {
  rawDescription: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (decision: MerchantDecision) => void;
}) {
  const categories = useCategories();
  const suggestedName = toTitleCase(cleanDescription(rawDescription)) || rawDescription;

  const [name, setName] = useState(suggestedName);
  const [kind, setKind] = useState<"merchant" | "person">("merchant");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [patterns, setPatterns] = useState(cleanDescription(rawDescription) || rawDescription);
  const [testResult, setTestResult] = useState<PatternTestResult | null>(null);
  const [isTesting, startTestTransition] = useTransition();
  const [state, formAction, pending] = useActionState<
    ActionResult<CreateDestinatarioResult>,
    FormData
  >(createDestinatario, { success: false, error: "" });

  useEffect(() => {
    if (!state.success) return;
    onCreated({
      destinatarioId: state.data.id,
      destinatarioName: state.data.name,
      categoryId: state.data.default_category_id ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleTestPatterns() {
    const allPatterns = patterns
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (allPatterns.length === 0) return;
    startTestTransition(async () => {
      const results = await Promise.all(
        allPatterns.map((p) => testDestinatarioPattern(p, "contains")),
      );
      const combined: PatternTestResult = { matchCount: 0, samples: [] };
      const seenIds = new Set<string>();
      for (const r of results) {
        if (!r.success) continue;
        combined.matchCount += r.data.matchCount;
        for (const s of r.data.samples) {
          if (!seenIds.has(s.id)) {
            seenIds.add(s.id);
            combined.samples.push(s);
          }
        }
      }
      combined.samples = combined.samples.slice(0, 5);
      setTestResult(combined);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear destinatario</DialogTitle>
          <p className="text-sm text-muted-foreground">
            A partir de «{rawDescription}». Se asignará a los movimientos que
            coincidan en esta importación.
          </p>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {!state.success && state.error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="merchant-dest-name">Nombre</Label>
            <Input
              id="merchant-dest-name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Nequi, Spotify, Rappi"
              required
            />
          </div>

          <div
            className="space-y-2"
            role="radiogroup"
            aria-labelledby="merchant-dest-tipo-label"
          >
            <Label id="merchant-dest-tipo-label">Tipo</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                role="radio"
                aria-checked={kind === "merchant"}
                onClick={() => setKind("merchant")}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  kind === "merchant"
                    ? "border-z-brass/40 bg-z-brass/10"
                    : "border-white/6 bg-z-surface-2",
                )}
              >
                Comercio
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={kind === "person"}
                onClick={() => setKind("person")}
                className={cn(
                  "rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                  kind === "person"
                    ? "border-z-brass/40 bg-z-brass/10"
                    : "border-white/6 bg-z-surface-2",
                )}
              >
                Persona
              </button>
            </div>
          </div>
          <input type="hidden" name="kind" value={kind} />

          <div className="space-y-2">
            <Label>Categoría por defecto</Label>
            <CategoryZonePicker
              categories={categories}
              value={categoryId}
              onValueChange={setCategoryId}
              variant="popover"
              name="default_category_id"
              placeholder="Sin categoría"
              triggerClassName="w-full"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="merchant-dest-patterns">Patrones</Label>
            <div className="flex gap-2">
              <Input
                id="merchant-dest-patterns"
                name="patterns"
                value={patterns}
                onChange={(e) => {
                  setPatterns(e.target.value);
                  if (testResult) setTestResult(null);
                }}
                placeholder="Ej: nequi pago, rappi, spotify"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleTestPatterns}
                disabled={!patterns.trim() || isTesting}
                title="Probar patrón"
              >
                {isTesting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Search className="size-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-z-sage-dark">
              Pre-llenado con la descripción. Ajusta o separa con comas para
              crear varias reglas. Aplican a futuras importaciones.
            </p>
            {testResult && (
              <div className="rounded-lg border border-z-border-strong bg-z-surface-2 p-3 space-y-2">
                <p className="text-xs font-medium">
                  {testResult.matchCount === 0
                    ? "Sin coincidencias en transacciones sin asignar"
                    : `${testResult.matchCount} transacción${testResult.matchCount === 1 ? "" : "es"} coinciden`}
                </p>
                {testResult.samples.length > 0 && (
                  <ul className="space-y-1">
                    {testResult.samples.map((s) => (
                      <li
                        key={s.id}
                        className="flex justify-between gap-2 text-xs text-z-sage-dark"
                      >
                        <span className="truncate">{s.rawDescription}</span>
                        <span className="shrink-0 tabular-nums">
                          {formatCurrency(s.amount, s.currencyCode as CurrencyCode)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <input type="hidden" name="is_active" value="true" />

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" className={BRASS_BUTTON_CLASS} disabled={pending}>
              {pending ? "Creando..." : "Crear y asignar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function toTitleCase(value: string): string {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
