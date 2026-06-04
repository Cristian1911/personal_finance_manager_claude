"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Search, Loader2 } from "lucide-react";
import {
  createDestinatario,
  testDestinatarioPattern,
  type CreateDestinatarioResult,
  type PatternTestResult,
} from "@/actions/destinatarios";
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
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/currency";
import type { ActionResult } from "@/types/actions";
import type { CategoryWithChildren, CurrencyCode } from "@/types/domain";

export function CreateDestinatarioDialog({
  categories,
  trigger,
}: {
  categories: CategoryWithChildren[];
  trigger?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [kind, setKind] = useState<"merchant" | "person">("merchant");
  const [isActive, setIsActive] = useState(true);
  const [patterns, setPatterns] = useState("");
  const [testResult, setTestResult] = useState<PatternTestResult | null>(null);
  const [isTesting, startTestTransition] = useTransition();
  const [state, formAction, pending] = useActionState<ActionResult<CreateDestinatarioResult>, FormData>(
    createDestinatario,
    { success: false, error: "" }
  );

  useEffect(() => {
    if (!state.success) return;
    router.refresh();
    setOpen(false);
    setCategoryId(null);
    setKind("merchant");
    setIsActive(true);
    setPatterns("");
    setTestResult(null);
  }, [router, state.success]);

  function handleTestPatterns() {
    const firstPattern = patterns.split(",")[0]?.trim();
    if (!firstPattern) return;
    startTestTransition(async () => {
      const result = await testDestinatarioPattern(firstPattern, "contains");
      if (result.success) setTestResult(result.data);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(next) => {
      setOpen(next);
      if (!next) {
        setCategoryId(null);
        setPatterns("");
        setTestResult(null);
      }
    }}>
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

          <div className="space-y-2" role="radiogroup" aria-labelledby="dest-create-tipo-label">
            <Label id="dest-create-tipo-label">Tipo</Label>
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
            <Label htmlFor="dest-patterns">Patrones</Label>
            <div className="flex gap-2">
              <Input
                id="dest-patterns"
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
              Separa varios patrones con comas para crear reglas iniciales de asociación.
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
                      <li key={s.id} className="text-xs text-muted-foreground flex justify-between gap-2">
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
