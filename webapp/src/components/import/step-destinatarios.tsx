"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Link2, Loader2, Plus, X } from "lucide-react";
import {
  cleanDescription,
  matchDestinatario,
  prepareDestinatarioRules,
} from "@zeta/shared";
import type { DestinatarioRule } from "@zeta/shared";
import {
  attachPatternToDestinatario,
  createDestinatario,
  getDestinatarios,
} from "@/actions/destinatarios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils/currency";
import { capitalize } from "@/lib/utils/string";
import type { CurrencyCode, CategoryWithChildren } from "@/types/domain";
import type { ParseResponse, StatementAccountMapping } from "@/types/import";

interface StepDestinatariosProps {
  parseResult: ParseResponse;
  mappings: StatementAccountMapping[];
  categories: CategoryWithChildren[];
  destinatarioRules: DestinatarioRule[];
  onContinue: (updatedRules: DestinatarioRule[]) => void;
  onBack: () => void;
}

interface SuggestionGroup {
  cleanedPattern: string;
  transactions: {
    stmtIdx: number;
    txIdx: number;
    date: string;
    rawDescription: string;
    amount: number;
    currency: string;
  }[];
}

export function StepDestinatarios({
  parseResult,
  mappings,
  categories,
  destinatarioRules,
  onContinue,
  onBack,
}: StepDestinatariosProps) {
  const [isPending, startTransition] = useTransition();
  const [createdPatterns, setCreatedPatterns] = useState<Set<string>>(new Set());
  const [dismissedPatterns, setDismissedPatterns] = useState<Set<string>>(new Set());
  const [currentRules, setCurrentRules] = useState<DestinatarioRule[]>(destinatarioRules);

  const [editingPattern, setEditingPattern] = useState<string | null>(null);
  const [assigningPattern, setAssigningPattern] = useState<string | null>(null);
  const [assignTargetId, setAssignTargetId] = useState<string>("");
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [matchedOpen, setMatchedOpen] = useState(false);

  // Full destinatarios list so the "Asignar" picker includes destinatarios
  // that have no rules yet (otherwise deriving from currentRules alone would
  // hide them). Fetched once when the user lands on this step.
  const [allDestinatarios, setAllDestinatarios] = useState<
    { id: string; name: string; default_category_id: string | null }[]
  >([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getDestinatarios();
      if (cancelled || !result.success) return;
      setAllDestinatarios(
        result.data.map((d) => ({
          id: d.id,
          name: d.name,
          default_category_id: d.default_category_id,
        }))
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Merge the full list with pattern counts derived from currentRules.
  // Sort by most-patterns-first so likely targets surface at the top.
  const existingDestinatarios = useMemo(() => {
    const patternCounts = new Map<string, number>();
    for (const rule of currentRules) {
      patternCounts.set(
        rule.destinatario_id,
        (patternCounts.get(rule.destinatario_id) ?? 0) + 1
      );
    }

    const map = new Map<
      string,
      { id: string; name: string; defaultCategoryId: string | null; patternCount: number }
    >();

    for (const d of allDestinatarios) {
      map.set(d.id, {
        id: d.id,
        name: d.name,
        defaultCategoryId: d.default_category_id,
        patternCount: patternCounts.get(d.id) ?? 0,
      });
    }

    // Rules can surface destinatarios created mid-session before the fetch
    // landed — include them so the picker updates immediately.
    for (const rule of currentRules) {
      if (map.has(rule.destinatario_id)) continue;
      map.set(rule.destinatario_id, {
        id: rule.destinatario_id,
        name: rule.destinatario_name,
        defaultCategoryId: rule.default_category_id,
        patternCount: patternCounts.get(rule.destinatario_id) ?? 1,
      });
    }

    return Array.from(map.values()).sort((a, b) => {
      if (b.patternCount !== a.patternCount) return b.patternCount - a.patternCount;
      return a.name.localeCompare(b.name);
    });
  }, [allDestinatarios, currentRules]);

  const { matchedGroups, suggestions } = useMemo(() => {
    const prepared = prepareDestinatarioRules(currentRules);
    const matchedByDest = new Map<string, number>();
    const unmatched: {
      stmtIdx: number;
      txIdx: number;
      date: string;
      rawDescription: string;
      amount: number;
      currency: string;
      cleaned: string;
    }[] = [];

    for (const [stmtIdx, stmt] of parseResult.statements.entries()) {
      const mapping = mappings.find((m) => m.statementIndex === stmtIdx);
      if (!mapping?.accountId) continue;

      for (const [txIdx, tx] of stmt.transactions.entries()) {
        const match = matchDestinatario(tx.description, prepared);
        if (match) {
          matchedByDest.set(
            match.destinatario_name,
            (matchedByDest.get(match.destinatario_name) ?? 0) + 1
          );
        } else {
          const cleaned = cleanDescription(tx.description);
          if (cleaned.length > 0) {
            unmatched.push({
              stmtIdx,
              txIdx,
              date: tx.date,
              rawDescription: tx.description,
              amount: tx.amount,
              currency: stmt.currency,
              cleaned,
            });
          }
        }
      }
    }

    const matched: { destName: string; count: number }[] = [];
    for (const [name, count] of matchedByDest) {
      matched.push({ destName: name, count });
    }
    matched.sort((a, b) => b.count - a.count);

    const groupMap = new Map<string, SuggestionGroup>();
    for (const tx of unmatched) {
      if (!groupMap.has(tx.cleaned)) {
        groupMap.set(tx.cleaned, { cleanedPattern: tx.cleaned, transactions: [] });
      }
      groupMap.get(tx.cleaned)!.transactions.push(tx);
    }

    const suggs = Array.from(groupMap.values())
      .filter((g) => g.transactions.length >= 2)
      .sort((a, b) => b.transactions.length - a.transactions.length);

    return { matchedGroups: matched, suggestions: suggs };
  }, [parseResult, mappings, currentRules]);

  const totalMatchedCount = matchedGroups.reduce((sum, g) => sum + g.count, 0);

  const visibleSuggestions = suggestions.filter(
    (s) => !createdPatterns.has(s.cleanedPattern) && !dismissedPatterns.has(s.cleanedPattern)
  );

  function handleStartEditing(suggestion: SuggestionGroup) {
    setEditingPattern(suggestion.cleanedPattern);
    setAssigningPattern(null);
    setFormName(capitalize(suggestion.cleanedPattern));
    setFormCategory(null);
    setFormError(null);
    setExpanded((prev) => new Set(prev).add(suggestion.cleanedPattern));
  }

  function handleStartAssigning(suggestion: SuggestionGroup) {
    setAssigningPattern(suggestion.cleanedPattern);
    setEditingPattern(null);
    setAssignTargetId(existingDestinatarios[0]?.id ?? "");
    setFormError(null);
    setExpanded((prev) => new Set(prev).add(suggestion.cleanedPattern));
  }

  function handleDismiss(pattern: string) {
    setDismissedPatterns((prev) => new Set(prev).add(pattern));
    if (editingPattern === pattern) setEditingPattern(null);
    if (assigningPattern === pattern) setAssigningPattern(null);
  }

  function handleAssign(pattern: string) {
    if (!assignTargetId) {
      setFormError("Elige un destinatario");
      return;
    }
    const target = existingDestinatarios.find((d) => d.id === assignTargetId);
    if (!target) {
      setFormError("Destinatario no encontrado");
      return;
    }

    startTransition(async () => {
      const result = await attachPatternToDestinatario(
        assignTargetId,
        pattern.toLowerCase()
      );

      if (result.success) {
        setCurrentRules((prev) => [
          ...prev,
          {
            destinatario_id: target.id,
            destinatario_name: target.name,
            default_category_id: target.defaultCategoryId,
            match_type: "contains" as const,
            pattern: pattern.toLowerCase(),
            priority: 100,
          },
        ]);
        setCreatedPatterns((prev) => new Set(prev).add(pattern));
        setAssigningPattern(null);
        setFormError(null);
      } else {
        setFormError(result.error);
      }
    });
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
        setCurrentRules((prev) => [
          ...prev,
          {
            destinatario_id: result.data!.id,
            destinatario_name: formName.trim(),
            default_category_id: formCategory,
            match_type: "contains" as const,
            pattern: pattern.toLowerCase(),
            priority: 100,
          },
        ]);
        setCreatedPatterns((prev) => new Set(prev).add(pattern));
        setEditingPattern(null);
        setFormError(null);
      } else {
        setFormError(result.error);
      }
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Destinatarios</h2>
        <p className="text-sm text-muted-foreground">
          Detectamos patrones en tus transacciones. Crea destinatarios para categorizar automáticamente.
        </p>
      </div>

      {totalMatchedCount > 0 && (
        <Collapsible open={matchedOpen} onOpenChange={setMatchedOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md border bg-z-income/5 p-3 text-left text-sm"
            >
              {matchedOpen ? (
                <ChevronDown className="h-4 w-4 shrink-0 text-z-income" />
              ) : (
                <ChevronRight className="h-4 w-4 shrink-0 text-z-income" />
              )}
              <span className="font-medium text-z-income">
                {totalMatchedCount} transacciones ya tienen destinatario asignado
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-1 rounded-md border bg-background p-3">
              <div className="space-y-1">
                {matchedGroups.map((g) => (
                  <div key={g.destName} className="flex items-center justify-between text-sm">
                    <span>{g.destName}</span>
                    <span className="text-muted-foreground">{g.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {visibleSuggestions.length > 0 ? (
        <div className="space-y-3">
          {visibleSuggestions.map((suggestion) => {
            const isEditing = editingPattern === suggestion.cleanedPattern;
            const isAssigning = assigningPattern === suggestion.cleanedPattern;
            const isExpanded = expanded.has(suggestion.cleanedPattern);

            return (
              <div key={suggestion.cleanedPattern} className="rounded-md border bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      className="flex items-center gap-1 text-sm font-medium"
                      onClick={() =>
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(suggestion.cleanedPattern)) next.delete(suggestion.cleanedPattern);
                          else next.add(suggestion.cleanedPattern);
                          return next;
                        })
                      }
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 shrink-0" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                      )}
                      {suggestion.cleanedPattern}
                    </button>
                    <p className="ml-5 text-xs text-muted-foreground">
                      {suggestion.transactions.length} transacciones
                    </p>
                  </div>

                  {!isEditing && !isAssigning && (
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        onClick={() => handleStartEditing(suggestion)}
                      >
                        <Plus className="h-3 w-3" />
                        Crear
                      </Button>
                      {existingDestinatarios.length > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          onClick={() => handleStartAssigning(suggestion)}
                        >
                          <Link2 className="h-3 w-3" />
                          Asignar
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => handleDismiss(suggestion.cleanedPattern)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <div className="mt-2 space-y-1 border-t pt-2">
                    {suggestion.transactions.map((tx) => (
                      <div
                        key={`${tx.stmtIdx}-${tx.txIdx}`}
                        className="flex items-center gap-2 rounded px-1 py-0.5 text-xs"
                      >
                        <span className="text-muted-foreground">{tx.date}</span>
                        <span className="flex-1 truncate">{tx.rawDescription}</span>
                        <span className="shrink-0">
                          {formatCurrency(tx.amount, tx.currency as CurrencyCode)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {isAssigning && (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-muted-foreground">
                        Destinatario existente
                      </label>
                      <Select
                        value={assignTargetId}
                        onValueChange={(v) => {
                          setAssignTargetId(v);
                          if (formError) setFormError(null);
                        }}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue placeholder="Elegir destinatario" />
                        </SelectTrigger>
                        <SelectContent>
                          {existingDestinatarios.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                              <span className="ml-2 text-xs text-muted-foreground">
                                {d.patternCount}{" "}
                                {d.patternCount === 1 ? "patrón" : "patrones"}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {formError && <p className="text-xs text-z-debt">{formError}</p>}

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        disabled={isPending || !assignTargetId}
                        onClick={() => handleAssign(suggestion.cleanedPattern)}
                      >
                        {isPending ? (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Asignando...
                          </>
                        ) : (
                          "Asignar patrón"
                        )}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        disabled={isPending}
                        onClick={() => setAssigningPattern(null)}
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}

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
                        <CategoryZonePicker
                          variant="popover"
                          categories={categories}
                          value={formCategory}
                          onValueChange={setFormCategory}
                          placeholder="Sin categoría"
                          triggerClassName="h-8 text-xs w-full sm:w-[180px]"
                        />
                      </div>
                    </div>

                    {formError && <p className="text-xs text-z-debt">{formError}</p>}

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
      ) : (
        createdPatterns.size === 0 && (
          <div className="rounded-md border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
            No detectamos patrones recurrentes en estas transacciones.
          </div>
        )
      )}

      {createdPatterns.size > 0 && visibleSuggestions.length === 0 && (
        <div className="rounded-md bg-z-income/10 p-3 text-sm text-z-income">
          Todos los patrones sugeridos han sido procesados.
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={onBack}>
          Volver
        </Button>
        <Button type="button" onClick={() => onContinue(currentRules)}>
          {visibleSuggestions.length > 0 ? "Omitir y continuar" : "Continuar"}
        </Button>
      </div>
    </div>
  );
}
