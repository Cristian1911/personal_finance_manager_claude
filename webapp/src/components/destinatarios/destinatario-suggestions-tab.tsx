"use client";

import { useCallback, useState, useTransition } from "react";
import { ChevronRight, Loader2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { createDestinatario } from "@/actions/destinatarios";
import type { DestinatarioSuggestionResult } from "@/actions/destinatarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import type { CurrencyCode, CategoryWithChildren } from "@/types/domain";

const DISMISS_STORAGE_KEY = "zeta:destinatario-suggestions-dismissed";
const DISMISS_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return new Set();
    const entries: { pattern: string; timestamp: number }[] = JSON.parse(raw);
    const now = Date.now();
    const active = entries.filter((e) => now - e.timestamp < DISMISS_EXPIRY_MS);
    if (active.length !== entries.length) {
      localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(active));
    }
    return new Set(active.map((e) => e.pattern));
  } catch {
    return new Set();
  }
}

function addDismissed(pattern: string) {
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    const entries: { pattern: string; timestamp: number }[] = raw ? JSON.parse(raw) : [];
    entries.push({ pattern, timestamp: Date.now() });
    localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

function capitalize(s: string): string {
  return s
    .toLowerCase()
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function DestinatarioSuggestionsTab({
  suggestions: initialSuggestions,
  categories,
}: {
  suggestions: DestinatarioSuggestionResult[];
  categories: CategoryWithChildren[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dismissed, setDismissed] = useState<Set<string>>(() => getDismissed());
  const [createdPatterns, setCreatedPatterns] = useState<Set<string>>(new Set());
  const [editingPattern, setEditingPattern] = useState<string | null>(null);
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const visibleSuggestions = initialSuggestions.filter(
    (s) => !dismissed.has(s.cleanedPattern) && !createdPatterns.has(s.cleanedPattern)
  );

  const handleDismiss = useCallback((pattern: string) => {
    addDismissed(pattern);
    setDismissed((prev) => new Set(prev).add(pattern));
    setEditingPattern((prev) => (prev === pattern ? null : prev));
  }, []);

  function handleStartEditing(suggestion: DestinatarioSuggestionResult) {
    setEditingPattern(suggestion.cleanedPattern);
    setFormName(capitalize(suggestion.cleanedPattern));
    setFormCategory(null);
    setFormError(null);
  }

  function handleCreate(pattern: string) {
    if (!formName.trim()) {
      setFormError("El nombre es obligatorio");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("name", formName.trim());
      if (formCategory) formData.set("default_category_id", formCategory);
      formData.set("patterns", JSON.stringify([pattern.toLowerCase()]));

      const result = await createDestinatario(
        { success: false, error: "" },
        formData
      );

      if (result.success) {
        setCreatedPatterns((prev) => new Set(prev).add(pattern));
        setEditingPattern(null);
        setFormError(null);
        router.refresh();
      } else {
        setFormError(result.error);
      }
    });
  }

  if (visibleSuggestions.length === 0) {
    return (
      <div className="rounded-md border bg-muted/50 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          No encontramos patrones nuevos. Las sugerencias aparecen cuando tienes transacciones recurrentes sin destinatario asignado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {visibleSuggestions.map((suggestion) => {
        const isEditing = editingPattern === suggestion.cleanedPattern;
        const dateFrom = formatDate(suggestion.dateRange.from);
        const dateTo = formatDate(suggestion.dateRange.to);

        return (
          <div key={suggestion.cleanedPattern} className="rounded-md border bg-background p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-medium">{suggestion.cleanedPattern}</h3>
                <p className="text-xs text-muted-foreground">
                  {suggestion.count} transacciones, {dateFrom} — {dateTo}
                </p>
              </div>
              {!isEditing && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs"
                    onClick={() => handleStartEditing(suggestion)}
                  >
                    <Plus className="h-3 w-3" />
                    Crear destinatario
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={() => handleDismiss(suggestion.cleanedPattern)}
                  >
                    Ignorar
                  </Button>
                </div>
              )}
            </div>

            <Collapsible>
              <CollapsibleTrigger asChild>
                <button type="button" className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                  <ChevronRight className="h-3 w-3" />
                  Ver transacciones
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 space-y-1">
                  {suggestion.sampleTransactions.map((tx, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">{tx.date}</span>
                      <span className="flex-1 truncate">{tx.rawDescription}</span>
                      <span className="shrink-0 font-mono">
                        {formatCurrency(tx.amount, "COP" as CurrencyCode)}
                      </span>
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>

            {isEditing && (
              <div className="mt-3 space-y-2 border-t pt-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Nombre</label>
                    <Input
                      value={formName}
                      onChange={(e) => {
                        setFormName(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      placeholder="Nombre del destinatario"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Categoría (opcional)</label>
                    <CategoryCombobox
                      categories={categories}
                      value={formCategory}
                      onValueChange={setFormCategory}
                      placeholder="Sin categoría"
                      triggerClassName="h-8 text-xs w-full sm:w-[180px]"
                    />
                  </div>
                </div>

                {formError && <p className="text-xs text-red-600">{formError}</p>}

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 gap-1 text-xs"
                    disabled={isPending}
                    onClick={() => handleCreate(suggestion.cleanedPattern)}
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Creando...
                      </>
                    ) : (
                      "Crear destinatario"
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    disabled={isPending}
                    onClick={() => setEditingPattern(null)}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
