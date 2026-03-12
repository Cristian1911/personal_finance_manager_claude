"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { ChevronDown, Lightbulb, Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { detectDestinatarioSuggestions } from "@zeta/shared";
import type { DestinatarioSuggestion } from "@zeta/shared";
import { createDestinatario } from "@/actions/destinatarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryCombobox } from "@/components/ui/category-combobox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { CategoryWithChildren } from "@/types/domain";

interface DestinatarioSuggestionsProps {
  /** Descriptions from the current import batch that didn't match any rule */
  batchDescriptions: string[];
  /** Historical unmatched descriptions from past transactions */
  historicalDescriptions: string[];
  /** Available categories for the inline form */
  categories: CategoryWithChildren[];
  /** Called after a destinatario is created so parent can re-run matching */
  onDestinatarioCreated: () => void;
}

/** Capitalize the first letter of each word in a pattern */
function capitalize(pattern: string): string {
  return pattern
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function DestinatarioSuggestions({
  batchDescriptions,
  historicalDescriptions,
  categories,
  onDestinatarioCreated,
}: DestinatarioSuggestionsProps) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState<string | null>(null);
  const [createdPatterns, setCreatedPatterns] = useState<Set<string>>(new Set());

  // Inline form state
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [formError, setFormError] = useState<string | null>(null);

  // Combine batch + historical, deduplicate, wrap in transaction objects
  const allTransactions = useMemo(() => {
    const seen = new Set<string>();
    const result: { description: string }[] = [];
    for (const desc of [...batchDescriptions, ...historicalDescriptions]) {
      const key = desc.toLowerCase().trim();
      if (key && !seen.has(key)) {
        seen.add(key);
        result.push({ description: desc });
      }
    }
    return result;
  }, [batchDescriptions, historicalDescriptions]);

  const suggestions = useMemo(
    () => detectDestinatarioSuggestions(allTransactions, 2),
    [allTransactions]
  );

  // Filter out dismissed and already-created suggestions
  const visibleSuggestions = useMemo(
    () =>
      suggestions.filter(
        (s) => !dismissed.has(s.cleanedPattern) && !createdPatterns.has(s.cleanedPattern)
      ),
    [suggestions, dismissed, createdPatterns]
  );

  const handleDismiss = useCallback(
    (pattern: string) => {
      setDismissed((prev) => new Set(prev).add(pattern));
      if (creating === pattern) setCreating(null);
    },
    [creating]
  );

  const handleStartCreating = useCallback(
    (suggestion: DestinatarioSuggestion) => {
      setCreating(suggestion.cleanedPattern);
      setFormName(capitalize(suggestion.cleanedPattern));
      setFormCategory(null);
      setFormError(null);
    },
    []
  );

  const handleCancelCreating = useCallback(() => {
    setCreating(null);
    setFormError(null);
  }, []);

  const handleCreate = useCallback(
    (pattern: string) => {
      if (!formName.trim()) {
        setFormError("El nombre es obligatorio");
        return;
      }

      startTransition(async () => {
        const formData = new FormData();
        formData.set("name", formName.trim());
        if (formCategory) formData.set("default_category_id", formCategory);
        formData.set("patterns", JSON.stringify([pattern]));

        const result = await createDestinatario(
          { success: false, error: "" },
          formData
        );

        if (result.success) {
          setCreatedPatterns((prev) => new Set(prev).add(pattern));
          setCreating(null);
          setFormError(null);
          router.refresh();
          onDestinatarioCreated();
        } else {
          setFormError(result.error);
        }
      });
    },
    [formName, formCategory, router, onDestinatarioCreated]
  );

  // Don't render if there are no suggestions
  if (visibleSuggestions.length === 0 && createdPatterns.size === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-md border bg-amber-500/5">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 p-3 text-left text-sm"
          >
            <Lightbulb className="h-4 w-4 shrink-0 text-amber-600" />
            <div className="flex-1">
              <span className="font-medium text-amber-800">
                Destinatarios sugeridos
              </span>
              {!open && visibleSuggestions.length > 0 && (
                <span className="ml-2 text-muted-foreground">
                  ({visibleSuggestions.length})
                </span>
              )}
            </div>
            <ChevronDown
              className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                open ? "rotate-180" : ""
              }`}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="border-t px-3 pb-3">
            <p className="py-2 text-xs text-muted-foreground">
              Detectamos patrones recurrentes en transacciones sin destinatario
            </p>

            {visibleSuggestions.length === 0 && createdPatterns.size > 0 && (
              <p className="py-2 text-xs text-emerald-700">
                Todos los patrones sugeridos han sido procesados. Refresca la
                pagina para aplicar las reglas a las transacciones.
              </p>
            )}

            <div className="space-y-2">
              {visibleSuggestions.map((suggestion) => (
                <div
                  key={suggestion.cleanedPattern}
                  className="rounded-md border bg-background p-3"
                >
                  {/* Summary row */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-medium">
                        {suggestion.count} transacciones con &quot;
                        <span className="text-amber-700">
                          {suggestion.cleanedPattern}
                        </span>
                        &quot;
                      </span>
                      {suggestion.rawDescriptions.length > 0 && (
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          Ej: {suggestion.rawDescriptions[0]}
                        </p>
                      )}
                    </div>

                    {creating !== suggestion.cleanedPattern && (
                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          onClick={() => handleStartCreating(suggestion)}
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
                          <X className="h-3 w-3" />
                          <span className="sr-only">Ignorar</span>
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Inline creation form */}
                  {creating === suggestion.cleanedPattern && (
                    <div className="mt-3 space-y-2 border-t pt-3">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                        <div className="flex-1 space-y-1">
                          <label
                            htmlFor={`dest-name-${suggestion.cleanedPattern}`}
                            className="text-xs font-medium text-muted-foreground"
                          >
                            Nombre
                          </label>
                          <Input
                            id={`dest-name-${suggestion.cleanedPattern}`}
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
                          <label className="text-xs font-medium text-muted-foreground">
                            Categoria (opcional)
                          </label>
                          <CategoryCombobox
                            categories={categories}
                            value={formCategory}
                            onValueChange={setFormCategory}
                            placeholder="Sin categoria"
                            triggerClassName="h-8 text-xs w-full sm:w-[180px]"
                          />
                        </div>
                      </div>

                      {formError && (
                        <p className="text-xs text-red-600">{formError}</p>
                      )}

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
                            "Crear"
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          disabled={isPending}
                          onClick={handleCancelCreating}
                        >
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
