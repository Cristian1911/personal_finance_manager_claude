"use client";

import * as React from "react";
import { Loader2, Search, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import {
  createDestinatario,
  testDestinatarioPattern,
  type CreateDestinatarioResult,
  type PatternTestResult,
} from "@/actions/destinatarios";
import { tokenizeDescription } from "@/lib/utils/tokenize-description";
import { formatCurrency } from "@/lib/utils/currency";
import { useMediaQuery } from "@/hooks/use-media-query";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { MOBILE_SHEET_SAFE_AREA_CLASS } from "@/lib/constants/styles";
import type { ActionResult } from "@/types/actions";
import type { CategoryWithChildren, CurrencyCode } from "@/types/domain";

export interface DestinatarioCreateSeed {
  rawDescription?: string | null;
  merchantName?: string | null;
  amount?: number | null;
  currencyCode?: CurrencyCode | null;
}

export interface DestinatarioCreateFormProps extends DestinatarioCreateSeed {
  categories: CategoryWithChildren[];
  /** Called with the created destinatario; caller handles assignment + close. */
  onCreated: (dest: {
    id: string;
    name: string;
    defaultCategoryId: string | null;
  }) => void;
  onCancel: () => void;
}

export function DestinatarioCreateForm({
  rawDescription,
  merchantName,
  amount,
  currencyCode,
  categories,
  onCreated,
  onCancel,
}: DestinatarioCreateFormProps) {
  const chips = React.useMemo(() => {
    const base = tokenizeDescription(rawDescription);
    const extra: string[] = [];
    if (merchantName?.trim()) extra.push(merchantName.trim());
    return Array.from(new Set([...extra, ...base]));
  }, [rawDescription, merchantName]);

  const [categoryId, setCategoryId] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<string[]>(chips[0] ? [chips[0]] : []);
  const [patterns, setPatterns] = React.useState(chips[0] ?? "");
  const [testResult, setTestResult] = React.useState<PatternTestResult | null>(null);
  const [isTesting, startTest] = React.useTransition();
  const [state, formAction, pending] = React.useActionState<
    ActionResult<CreateDestinatarioResult>,
    FormData
  >(createDestinatario, { success: false, error: "" });

  function toggleChip(token: string) {
    setTestResult(null);
    setSelected((prev) => {
      const next = prev.includes(token)
        ? prev.filter((t) => t !== token)
        : [...prev, token];
      setPatterns(next.join(" "));
      return next;
    });
  }

  React.useEffect(() => {
    if (state.success) {
      onCreated({
        id: state.data.id,
        name: state.data.name,
        defaultCategoryId: state.data.default_category_id ?? null,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function handleTest() {
    const list = patterns.split(",").map((p) => p.trim()).filter(Boolean);
    if (list.length === 0) return;
    startTest(async () => {
      const results = await Promise.all(
        list.map((p) => testDestinatarioPattern(p, "contains")),
      );
      const combined: PatternTestResult = { matchCount: 0, samples: [] };
      const seen = new Set<string>();
      for (const r of results) {
        if (!r.success) continue;
        combined.matchCount += r.data.matchCount;
        for (const s of r.data.samples) {
          if (!seen.has(s.id)) {
            seen.add(s.id);
            combined.samples.push(s);
          }
        }
      }
      combined.samples = combined.samples.slice(0, 5);
      setTestResult(combined);
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      {!state.success && state.error && (
        <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="dcf-name">Nombre</Label>
        <Input
          id="dcf-name"
          name="name"
          defaultValue={merchantName?.trim() || chips[0] || ""}
          placeholder="Ej: Nequi, Spotify"
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
        <Label>Patrones de detección</Label>
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {chips.map((token) => (
              <button
                key={token}
                type="button"
                onClick={() => toggleChip(token)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                  selected.includes(token)
                    ? "border-z-brass/30 bg-z-brass/10 text-z-brass"
                    : "border-white/6 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]",
                )}
              >
                {token}
              </button>
            ))}
            {amount != null && currencyCode && (
              <span className="rounded-full border border-white/6 bg-white/[0.02] px-2.5 py-1 text-[11px] text-muted-foreground/70">
                {formatCurrency(amount, currencyCode)}
              </span>
            )}
          </div>
        )}
        <div className="flex gap-2">
          <Input
            name="patterns"
            value={patterns}
            className="flex-1"
            onChange={(e) => {
              setPatterns(e.target.value);
              setTestResult(null);
            }}
            placeholder="Toca chips o escribe; separa con comas para varias reglas"
          />
          <Button
            type="button"
            size="icon"
            className={GHOST_BUTTON_CLASS}
            onClick={handleTest}
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
          Toca las palabras de esta transacción para crear patrones de detección.
        </p>
        {testResult && (
          <div className="space-y-2 rounded-lg border border-white/6 bg-z-surface-2 p-3">
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
                    className="flex justify-between gap-2 text-xs text-muted-foreground"
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

      <div className="space-y-2">
        <Label htmlFor="dcf-notes">Notas (opcional)</Label>
        <textarea
          id="dcf-notes"
          name="notes"
          rows={2}
          placeholder="Cualquier detalle útil sobre este destinatario…"
          className="w-full rounded-lg border border-white/6 bg-white/[0.03] px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-z-brass/40"
        />
      </div>

      <input type="hidden" name="is_active" value="true" />

      <div className="flex justify-end gap-2">
        <Button type="button" className={GHOST_BUTTON_CLASS} onClick={onCancel} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" className={BRASS_BUTTON_CLASS} disabled={pending}>
          {pending ? "Creando…" : "Crear y asignar"}
        </Button>
      </div>
    </form>
  );
}

// ─── Responsive dialog wrapper ───────────────────────────────────────────────

export interface DestinatarioCreateDialogProps extends DestinatarioCreateFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Wraps DestinatarioCreateForm in a Dialog (desktop) / Drawer (mobile). */
export function DestinatarioCreateDialog({
  open,
  onOpenChange,
  ...formProps
}: DestinatarioCreateDialogProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const title = "Crear destinatario";
  const description = "Crea un destinatario a partir de esta transacción.";

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserRound className="size-4 text-z-brass" />
              {title}
            </DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DestinatarioCreateForm {...formProps} />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <UserRound className="size-4 text-z-brass" />
            {title}
          </DrawerTitle>
          <DrawerDescription>{description}</DrawerDescription>
        </DrawerHeader>
        <div className={cn("overflow-y-auto px-4", MOBILE_SHEET_SAFE_AREA_CLASS)}>
          <DestinatarioCreateForm {...formProps} />
        </div>
      </DrawerContent>
    </Drawer>
  );
}
