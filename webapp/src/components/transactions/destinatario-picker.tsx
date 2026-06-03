"use client";

import * as React from "react";
import {
  Check,
  ChevronsUpDown,
  X,
  Loader2,
  Plus,
  Search,
} from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import {
  assignDestinatario,
  removeDestinatarioFromTransaction,
} from "@/actions/categorize";
import {
  createDestinatario,
  testDestinatarioPattern,
  type CreateDestinatarioResult,
  type PatternTestResult,
} from "@/actions/destinatarios";
import { formatCurrency } from "@/lib/utils/currency";
import type { ActionResult } from "@/types/actions";
import type { CategoryWithChildren, CurrencyCode, DestinatarioKind } from "@/types/domain";

type DestinatarioOption = {
  id: string;
  name: string;
  is_active: boolean;
  kind?: DestinatarioKind;
};

interface DestinatarioPickerProps {
  transactionId: string;
  currentDestinatarioId: string | null;
  destinatarios: DestinatarioOption[];
  rawDescription?: string | null;
  categories?: CategoryWithChildren[];
  /** Restrict the list to these destinatario kinds (e.g. ["person"]). Omit = all. */
  kindFilter?: DestinatarioKind[];
}

export function DestinatarioPicker({
  transactionId,
  currentDestinatarioId,
  destinatarios,
  rawDescription,
  categories,
  kindFilter,
}: DestinatarioPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState(currentDestinatarioId);
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);

  const activeDestinatarios = destinatarios.filter(
    (d) => d.is_active && (!kindFilter || (d.kind != null && kindFilter.includes(d.kind)))
  );
  const selected = destinatarios.find((d) => d.id === selectedId);

  async function handleSelect(destinatarioId: string) {
    setOpen(false);
    setLoading(true);
    try {
      const result = await assignDestinatario(transactionId, destinatarioId);
      if (result.success) {
        setSelectedId(destinatarioId);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove() {
    setLoading(true);
    try {
      const result = await removeDestinatarioFromTransaction(transactionId);
      if (result.success) {
        setSelectedId(null);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleCreateNew() {
    setOpen(false);
    setShowCreateDialog(true);
  }

  async function handleCreated(destinatarioId: string) {
    setShowCreateDialog(false);
    setLoading(true);
    try {
      const result = await assignDestinatario(transactionId, destinatarioId);
      if (result.success) {
        setSelectedId(destinatarioId);
      }
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Actualizando...</span>
      </div>
    );
  }

  // If a destinatario is assigned, show it as a badge with remove button
  if (selected) {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Link href={`/destinatarios/${selected.id}`}>
          <Badge
            variant="secondary"
            className="cursor-pointer hover:bg-secondary/80"
          >
            {selected.name}
          </Badge>
        </Link>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
          onClick={handleRemove}
        >
          <X className="h-3 w-3 mr-1" />
          Quitar
        </Button>
      </div>
    );
  }

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            size="sm"
            className="justify-between font-normal text-muted-foreground"
          >
            Seleccionar destinatario...
            <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[240px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar destinatario..." />
            <CommandList>
              <CommandEmpty>Sin resultados.</CommandEmpty>
              <CommandGroup>
                {activeDestinatarios.map((d) => (
                  <CommandItem
                    key={d.id}
                    value={d.name}
                    onSelect={() => handleSelect(d.id)}
                  >
                    {d.name}
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        selectedId === d.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
              {categories && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem onSelect={handleCreateNew}>
                      <Plus className="mr-2 h-4 w-4" />
                      Crear nuevo destinatario
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {categories && showCreateDialog && (
        <InlineCreateDestinatarioDialog
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          categories={categories}
          rawDescription={rawDescription}
          onCreated={handleCreated}
        />
      )}
    </>
  );
}

// ─── Inline Create Dialog ────────────────────────────────────────────────────

function InlineCreateDestinatarioDialog({
  open,
  onOpenChange,
  categories,
  rawDescription,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: CategoryWithChildren[];
  rawDescription?: string | null;
  onCreated: (destinatarioId: string) => void;
}) {
  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [patterns, setPatterns] = React.useState("");
  const [testResult, setTestResult] = React.useState<PatternTestResult | null>(
    null
  );
  const [isTesting, startTestTransition] = React.useTransition();
  const [state, formAction, pending] = React.useActionState<
    ActionResult<CreateDestinatarioResult>,
    FormData
  >(createDestinatario, { success: false, error: "" });

  // Pre-fill pattern from raw description when opening
  React.useEffect(() => {
    if (open && rawDescription) {
      setPatterns(rawDescription);
      setTestResult(null);
    }
  }, [open, rawDescription]);

  // Handle successful creation
  React.useEffect(() => {
    if (!state.success) return;
    const createdId = state.data.id;
    setCategoryId(null);
    setPatterns("");
    setTestResult(null);
    onCreated(createdId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  // Reset form when closing
  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setCategoryId(null);
      setPatterns("");
      setTestResult(null);
    }
  }

  function handleTestPatterns() {
    const allPatterns = patterns
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);
    if (allPatterns.length === 0) return;
    startTestTransition(async () => {
      // Test all patterns and aggregate results
      const results = await Promise.all(
        allPatterns.map((p) => testDestinatarioPattern(p, "contains"))
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
      // Limit displayed samples to 5
      combined.samples = combined.samples.slice(0, 5);
      setTestResult(combined);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Crear destinatario</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Crea un destinatario a partir de esta transacción. Prueba los
            patrones antes de guardar.
          </p>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {!state.success && state.error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {state.error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="inline-dest-name">Nombre</Label>
            <Input
              id="inline-dest-name"
              name="name"
              placeholder="Ej: Nequi, Spotify, Rappi"
              required
            />
          </div>

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
            <Label htmlFor="inline-dest-patterns">Patrones</Label>
            <div className="flex gap-2">
              <Input
                id="inline-dest-patterns"
                name="patterns"
                placeholder="Ej: nequi pago, rappi, spotify"
                value={patterns}
                onChange={(e) => {
                  setPatterns(e.target.value);
                  if (testResult) setTestResult(null);
                }}
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
            <p className="text-xs text-muted-foreground">
              Pre-llenado con la descripción de esta transacción. Ajusta o
              separa con comas para crear varias reglas.
            </p>
            {testResult && (
              <div className="rounded-lg border border-z-border-strong bg-z-surface-2 p-3 space-y-2">
                <p className="text-xs font-medium">
                  {testResult.matchCount === 0
                    ? "Sin coincidencias en transacciones sin asignar"
                    : `${testResult.matchCount} transaccion${testResult.matchCount === 1 ? "" : "es"} coinciden`}
                </p>
                {testResult.samples.length > 0 && (
                  <ul className="space-y-1">
                    {testResult.samples.map((s) => (
                      <li
                        key={s.id}
                        className="text-xs text-muted-foreground flex justify-between gap-2"
                      >
                        <span className="truncate">{s.rawDescription}</span>
                        <span className="shrink-0 tabular-nums">
                          {formatCurrency(
                            s.amount,
                            s.currencyCode as CurrencyCode
                          )}
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
              onClick={() => handleOpenChange(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="bg-z-brass text-z-ink hover:bg-z-brass/90"
              disabled={pending}
            >
              {pending ? "Creando..." : "Crear y asignar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
