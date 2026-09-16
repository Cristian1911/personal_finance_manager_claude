"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import {
  autoCategorize,
  matchDestinatario,
  prepareDestinatarioRules,
  type DestinatarioRule,
} from "@zeta/shared";
import { previewImportReconciliation } from "@/actions/import-transactions";
import type { TransactionCaptureMethod } from "@/types/domain";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SectionDivider } from "./section-divider";
import { CreditCardSummary } from "./credit-card-summary";
import { SavingsSummary } from "./savings-summary";
import { CreditCardStackCard } from "./credit-card-stack-card";
import { StatementSummaryCard } from "./statement-summary-card";
import { CreateAccountDialog } from "./create-account-dialog";
import { ParsedTransactionTable } from "./parsed-transaction-table";
import { AccountAssignControl } from "./account-assign-control";
import { WizardActionBar } from "./wizard-action-bar";
import { DestinatarioCreateDialog } from "@/components/destinatarios/destinatario-create-form";
import { CategoryZonePicker } from "@/components/categories/category-zone-picker";
import { TagZonePicker } from "@/components/tags/tag-zone-picker";
import { ImportSharePicker, type SharePreviewRow } from "./import-share-picker";
import { useActiveModo, useCategories } from "@/components/providers/app-data-provider";
import { computeInstallmentGroupId } from "@/lib/utils/idempotency";
import { trackClientEvent } from "@/lib/utils/analytics";
import { cn } from "@/lib/utils";
import { GHOST_BUTTON_CLASS, PANEL_INSET_CLASS, chipToggleClass } from "@/lib/constants/styles";
import {
  EMPTY_ENRICHMENT,
  REVIEW_FILTER_LABELS,
  effectiveEnrichment,
  matchesReviewFilter,
  type ReviewFilter,
  type RowEnrichment,
  type RowShare,
} from "@/lib/import/review-enrichment";
import type { Account, CurrencyCode, CategoryWithChildren, ModoWithParticipants } from "@/types/domain";
import type {
  ParseResponse,
  ReconciliationPreviewResult,
  StatementAccountMapping,
  StatementMetaForImport,
  TransactionToImport,
} from "@/types/import";

type ContinuePayload = {
  transactions: TransactionToImport[];
  statementMeta: StatementMetaForImport[];
  reconciliationPreview: ReconciliationPreviewResult;
};

type Props = {
  parseResult: ParseResponse;
  captureMethod: TransactionCaptureMethod;
  accounts: Account[];
  mappings: StatementAccountMapping[];
  destinatarioRules: DestinatarioRule[];
  /** Trips for the per-row picker and the "Personas del viaje" share preset. */
  modos?: ModoWithParticipants[];
  onMappingsChange: (mappings: StatementAccountMapping[]) => void;
  onContinue: (payload: ContinuePayload) => void;
  onBack: () => void;
  onAccountCreated: (account: Account) => void;
};

export function StepReview({
  parseResult,
  captureMethod,
  accounts,
  mappings,
  destinatarioRules,
  modos = [],
  onMappingsChange,
  onContinue,
  onBack,
  onAccountCreated,
}: Props) {
  const [localMappings, setLocalMappings] = useState<StatementAccountMapping[]>(mappings);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStatementIndex, setDialogStatementIndex] = useState(0);
  const [expandedStatement, setExpandedStatement] = useState<number | null>(null);
  const [preparing, setPreparing] = useState(false);

  const [selections, setSelections] = useState<Map<number, Set<number>>>(() => {
    const initial = new Map<number, Set<number>>();
    parseResult.statements.forEach((stmt, idx) => {
      initial.set(idx, new Set(stmt.transactions.map((_, i) => i)));
    });
    return initial;
  });

  const categories = useCategories();
  // Destinatarios created during review (keyed `${stmtIdx}-${txIdx}`). These
  // override the page-loaded auto-match, which can't know about new ones.
  const [destOverrides, setDestOverrides] = useState<
    Map<string, { id: string; name: string }>
  >(new Map());
  // Category from a destinatario created in-review (its default_category_id),
  // so the imported row gets categorized — the auto-match catMap can't know it.
  const [catOverrides, setCatOverrides] = useState<Map<string, string | null>>(
    new Map(),
  );
  const [destDialogTarget, setDestDialogTarget] = useState<{
    stmtIdx: number;
    txIdx: number;
  } | null>(null);

  // ── Per-row decisions: viaje, compartido con…, etiquetas, nota ──
  // Explicit picks only; everything else is derived (active-trip default).
  const activeModo = useActiveModo();
  const [enrichments, setEnrichments] = useState<Map<string, RowEnrichment>>(new Map());
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>("all");
  const [shareTarget, setShareTarget] = useState<{ stmtIdx: number; txIdx: number } | "bulk" | null>(null);
  const [bulkTagIds, setBulkTagIds] = useState<string[]>([]);
  const [bulkModo, setBulkModo] = useState("");

  const { destMap, catMap } = useMemo(() => {
    const prepared = prepareDestinatarioRules(destinatarioRules);
    const dest = new Map<string, { id: string; name: string }>();
    const cat = new Map<string, string | null>();
    parseResult.statements.forEach((stmt, stmtIdx) => {
      stmt.transactions.forEach((tx, txIdx) => {
        const match = matchDestinatario(tx.description, prepared);
        if (match) {
          const key = `${stmtIdx}-${txIdx}`;
          dest.set(key, { id: match.destinatario_id, name: match.destinatario_name });
          if (match.category_id) cat.set(key, match.category_id);
        }
      });
    });
    return { destMap: dest, catMap: cat };
  }, [parseResult, destinatarioRules]);

  // Rule-engine suggestions for rows no destinatario placed. The import path
  // never ran the categorizer, so statement rows arrived uncategorized however
  // obvious the merchant was. Computed here (not in the server action) so the
  // suggestion is visible and editable in the review step before insert.
  const sysCatMap = useMemo(() => {
    const out = new Map<string, { categoryId: string; confidence: number }>();
    parseResult.statements.forEach((stmt, stmtIdx) => {
      stmt.transactions.forEach((tx, txIdx) => {
        const key = `${stmtIdx}-${txIdx}`;
        if (catMap.get(key)) return;
        const hit = autoCategorize(tx.description);
        if (hit) {
          out.set(key, {
            categoryId: hit.category_id,
            confidence: hit.categorization_confidence,
          });
        }
      });
    });
    return out;
  }, [parseResult, catMap]);

  // Auto-match + in-review overrides combined; overrides win.
  const mergedDestMap = useMemo(() => {
    if (destOverrides.size === 0) return destMap;
    const merged = new Map(destMap);
    for (const [key, value] of destOverrides) merged.set(key, value);
    return merged;
  }, [destMap, destOverrides]);

  const mergedCatMap = useMemo(() => {
    if (catOverrides.size === 0) return catMap;
    const merged = new Map(catMap);
    for (const [key, value] of catOverrides) merged.set(key, value);
    return merged;
  }, [catMap, catOverrides]);

  // What the review table shows: explicit assignment wins, suggestion fills in.
  const displayCatMap = useMemo(() => {
    const merged = new Map<string, string | null>(mergedCatMap);
    for (const [key, sug] of sysCatMap) {
      if (!merged.get(key)) merged.set(key, sug.categoryId);
    }
    return merged;
  }, [mergedCatMap, sysCatMap]);

  // Keys the rule engine filled in. A user pick or a destinatario match removes
  // the key, so confirming a suggestion also drops the "Sugerida" marker.
  const suggestedKeys = useMemo(() => {
    const out = new Set<string>();
    for (const key of sysCatMap.keys()) {
      if (!mergedCatMap.get(key)) out.add(key);
    }
    return out;
  }, [sysCatMap, mergedCatMap]);

  function handleCategoryChange(stmtIdx: number, txIdx: number, categoryId: string | null) {
    setCatOverrides((prev) => new Map(prev).set(`${stmtIdx}-${txIdx}`, categoryId));
  }

  // What every row will get at import: explicit decision, or the active-trip
  // default for spend inside the trip's dates (never cuotas — same rule as the tray).
  const { effectiveMap, defaultModoKeys } = useMemo(() => {
    const map = new Map<string, RowEnrichment>();
    const defaults = new Set<string>();
    parseResult.statements.forEach((stmt, stmtIdx) => {
      stmt.transactions.forEach((tx, txIdx) => {
        const key = `${stmtIdx}-${txIdx}`;
        const explicit = enrichments.get(key);
        const value = effectiveEnrichment(
          explicit,
          { date: tx.date, direction: tx.direction, installment_current: tx.installment_current },
          activeModo,
        );
        map.set(key, value);
        if (!explicit && value.modoId) defaults.add(key);
      });
    });
    return { effectiveMap: map, defaultModoKeys: defaults };
  }, [parseResult, enrichments, activeModo]);

  // Triage chips: which rows each filter shows, and how many.
  const { visibleByStmt, filterCounts } = useMemo(() => {
    const visible = new Map<number, Set<number>>();
    const counts: Record<ReviewFilter, number> = { all: 0, uncategorized: 0, installments: 0, newMerchants: 0, trip: 0 };
    parseResult.statements.forEach((stmt, stmtIdx) => {
      const set = new Set<number>();
      stmt.transactions.forEach((tx, txIdx) => {
        const key = `${stmtIdx}-${txIdx}`;
        const facts = {
          hasCategory: !!displayCatMap.get(key),
          isInstallment: tx.installment_current != null,
          hasDestinatario: mergedDestMap.has(key),
          modoId: effectiveMap.get(key)?.modoId ?? null,
        };
        (Object.keys(counts) as ReviewFilter[]).forEach((f) => {
          if (matchesReviewFilter(f, facts)) counts[f] += 1;
        });
        if (matchesReviewFilter(reviewFilter, facts)) set.add(txIdx);
      });
      visible.set(stmtIdx, set);
    });
    return { visibleByStmt: visible, filterCounts: counts };
  }, [parseResult, displayCatMap, mergedDestMap, effectiveMap, reviewFilter]);

  function patchEnrichment(stmtIdx: number, txIdx: number, patch: Partial<RowEnrichment>) {
    const key = `${stmtIdx}-${txIdx}`;
    setEnrichments((prev) => {
      const base = prev.get(key) ?? effectiveMap.get(key) ?? EMPTY_ENRICHMENT;
      return new Map(prev).set(key, { ...base, ...patch });
    });
  }

  // Bulk actions touch only rows that are visible under the current chip AND
  // checked for import — the checkbox keeps its single meaning ("importar").
  function bulkTargets(): { stmtIdx: number; txIdx: number }[] {
    const out: { stmtIdx: number; txIdx: number }[] = [];
    parseResult.statements.forEach((_, stmtIdx) => {
      const sel = selections.get(stmtIdx) ?? new Set<number>();
      const vis = visibleByStmt.get(stmtIdx) ?? new Set<number>();
      for (const txIdx of sel) if (vis.has(txIdx)) out.push({ stmtIdx, txIdx });
    });
    return out;
  }
  const bulkCount = bulkTargets().length;

  function applyBulkEnrichment(patch: Partial<RowEnrichment> | ((current: RowEnrichment) => Partial<RowEnrichment>)) {
    const targets = bulkTargets();
    setEnrichments((prev) => {
      const next = new Map(prev);
      for (const { stmtIdx, txIdx } of targets) {
        const key = `${stmtIdx}-${txIdx}`;
        const base = prev.get(key) ?? effectiveMap.get(key) ?? EMPTY_ENRICHMENT;
        const p = typeof patch === "function" ? patch(base) : patch;
        next.set(key, { ...base, ...p });
      }
      return next;
    });
  }

  function applyBulkCategory(categoryId: string | null) {
    const targets = bulkTargets();
    setCatOverrides((prev) => {
      const next = new Map(prev);
      for (const { stmtIdx, txIdx } of targets) next.set(`${stmtIdx}-${txIdx}`, categoryId);
      return next;
    });
  }

  function handleShareChange(share: RowShare | null) {
    if (shareTarget === "bulk") {
      applyBulkEnrichment({ share });
    } else if (shareTarget) {
      patchEnrichment(shareTarget.stmtIdx, shareTarget.txIdx, { share });
    }
  }

  const totalRows = parseResult.statements.reduce((n, s) => n + s.transactions.length, 0);

  function openDestDialog(stmtIdx: number, txIdx: number) {
    setDestDialogTarget({ stmtIdx, txIdx });
  }

  function handleDestinatarioCreated(dest: {
    id: string;
    name: string;
    defaultCategoryId: string | null;
  }) {
    if (!destDialogTarget) return;
    const key = `${destDialogTarget.stmtIdx}-${destDialogTarget.txIdx}`;
    setDestOverrides((prev) =>
      new Map(prev).set(key, { id: dest.id, name: dest.name }),
    );
    // Apply the destinatario's default category to this row if it has one and
    // the row isn't already categorized by auto-match.
    if (dest.defaultCategoryId && !catMap.get(key)) {
      setCatOverrides((prev) => new Map(prev).set(key, dest.defaultCategoryId));
    }
    setDestDialogTarget(null);
  }

  const [prevMappings, setPrevMappings] = useState(mappings);
  if (mappings !== prevMappings) {
    setPrevMappings(mappings);
    setLocalMappings((local) =>
      mappings.map((m) => {
        const entry = local.find((l) => l.statementIndex === m.statementIndex);
        if (m.autoMatched && entry && !entry.accountId) return m;
        if (entry && entry.accountId && !entry.autoMatched) return entry;
        return m;
      }),
    );
  }

  // Multi-CC detection: all statements are credit_card with metadata.
  // Switch to compact stack cards instead of one hero summary per statement.
  const allCreditCard =
    parseResult.statements.length > 1 &&
    parseResult.statements.every(
      (s) => s.statement_type === "credit_card" && s.credit_card_metadata != null,
    );

  function updateMapping(index: number, accountId: string) {
    setLocalMappings((prev) => {
      const next = prev.map((m) =>
        m.statementIndex === index ? { ...m, accountId, autoMatched: false } : m,
      );
      onMappingsChange(next);
      return next;
    });
  }

  function updatePrimaryCurrency(accountId: string, currency: string) {
    setLocalMappings((prev) => {
      const next = prev.map((m) =>
        m.accountId === accountId ? { ...m, primaryCurrency: currency } : m,
      );
      onMappingsChange(next);
      return next;
    });
  }

  function getCurrenciesForAccount(accountId: string): string[] {
    const currencies = new Set<string>();
    localMappings.forEach((m) => {
      if (m.accountId === accountId) {
        const stmt = parseResult.statements[m.statementIndex];
        if (stmt) currencies.add(stmt.currency);
      }
    });
    return Array.from(currencies);
  }

  function getDefaultPrimaryCurrency(accountId: string): string {
    let best = "";
    let bestCount = -1;
    localMappings.forEach((m) => {
      if (m.accountId !== accountId) return;
      const stmt = parseResult.statements[m.statementIndex];
      if (!stmt) return;
      const count = stmt.transactions.length;
      if (stmt.currency === "COP" || count > bestCount) {
        if (best !== "COP") {
          best = stmt.currency;
          bestCount = count;
        }
      }
    });
    return best;
  }

  function toggleTransaction(stmtIdx: number, txIdx: number) {
    setSelections((prev) => {
      const next = new Map(prev);
      const set = new Set(next.get(stmtIdx) ?? []);
      if (set.has(txIdx)) set.delete(txIdx);
      else set.add(txIdx);
      next.set(stmtIdx, set);
      return next;
    });
  }

  function toggleAllForStatement(stmtIdx: number) {
    setSelections((prev) => {
      const next = new Map(prev);
      const current = next.get(stmtIdx) ?? new Set();
      const total = parseResult.statements[stmtIdx].transactions.length;
      if (current.size === total) next.set(stmtIdx, new Set());
      else next.set(stmtIdx, new Set(Array.from({ length: total }, (_, i) => i)));
      return next;
    });
  }

  function openCreateDialog(stmtIndex: number) {
    setDialogStatementIndex(stmtIndex);
    setDialogOpen(true);
  }

  function handleAccountCreated(account: Account) {
    onAccountCreated(account);
    updateMapping(dialogStatementIndex, account.id);
  }

  async function buildTransactions(): Promise<TransactionToImport[]> {
    // Collect the rows first so installment hashes can resolve in parallel.
    type Row = {
      stmtIdx: number;
      txIdx: number;
      accountId: string;
      stmt: (typeof parseResult.statements)[number];
      tx: (typeof parseResult.statements)[number]["transactions"][number];
    };
    const rows: Row[] = [];
    for (const [stmtIdx, stmt] of parseResult.statements.entries()) {
      const mapping = localMappings.find((m) => m.statementIndex === stmtIdx);
      if (!mapping?.accountId) continue;
      const sel = selections.get(stmtIdx) ?? new Set();
      for (const txIdx of sel) {
        rows.push({ stmtIdx, txIdx, accountId: mapping.accountId, stmt, tx: stmt.transactions[txIdx] });
      }
    }

    const installmentIds = await Promise.all(
      rows.map((row) =>
        row.tx.installment_current != null && row.tx.installment_total != null
          ? computeInstallmentGroupId({
              accountId: row.accountId,
              rawDescription: row.tx.description,
              amount: row.tx.original_amount ?? row.tx.amount,
            })
          : Promise.resolve<string | null>(null),
      ),
    );

    return rows.map((row, i) => {
      const key = `${row.stmtIdx}-${row.txIdx}`;
      const destMatch = mergedDestMap.get(key);
      const destinatarioId = destMatch?.id ?? null;
      const merchantName = destMatch?.name ?? null;

      // Destinatario match (or an explicit user pick) wins. When neither placed
      // the row, fall back to the rule engine — the import path never ran it, so
      // every statement row arrived uncategorized no matter how obvious the
      // merchant was. Suggestions land here, in the review step, so they are
      // visible and editable before anything is inserted.
      const matchedCategoryId = mergedCatMap.get(key) ?? null;
      const suggestion = matchedCategoryId ? null : sysCatMap.get(key);
      const categoryId = matchedCategoryId ?? suggestion?.categoryId ?? null;

      let categorizationSource:
        | "USER_LEARNED"
        | "USER_OVERRIDE"
        | "SYSTEM_DEFAULT"
        | undefined;
      let categorizationConfidence: number | null = null;
      if (matchedCategoryId) {
        categorizationSource = destinatarioId ? "USER_LEARNED" : "USER_OVERRIDE";
        categorizationConfidence = destinatarioId ? 0.8 : null;
      } else if (suggestion) {
        categorizationSource = "SYSTEM_DEFAULT";
        categorizationConfidence = suggestion.confidence;
      }

      const enrichment = effectiveMap.get(key) ?? EMPTY_ENRICHMENT;
      const share =
        enrichment.share && enrichment.share.participants.length > 0 && row.tx.direction === "OUTFLOW"
          ? {
              method: enrichment.share.method,
              userIncluded: enrichment.share.userIncluded,
              participants: enrichment.share.participants.map((p) => ({
                destinatario_id: p.destinatario_id,
                ...(p.value != null ? { value: p.value } : {}),
              })),
              ea_rate_percent: row.stmt.credit_card_metadata?.interest_rate ?? null,
            }
          : null;
      const notes = enrichment.notes.trim();

      return {
        import_key: `${row.stmtIdx}:${row.txIdx}`,
        account_id: row.accountId,
        amount: row.tx.amount,
        currency_code: row.stmt.currency,
        direction: row.tx.direction,
        transaction_date: row.tx.date,
        raw_description: row.tx.description,
        category_id: categoryId,
        categorization_source: categorizationSource,
        categorization_confidence: categorizationConfidence,
        installment_current: row.tx.installment_current,
        installment_total: row.tx.installment_total,
        installment_group_id: installmentIds[i],
        original_amount: row.tx.original_amount,
        destinatario_id: destinatarioId,
        merchant_name: merchantName,
        ...(notes ? { notes } : {}),
        ...(enrichment.tagIds.length > 0 ? { tag_ids: enrichment.tagIds } : {}),
        ...(enrichment.modoId && row.tx.direction === "OUTFLOW" ? { modo_id: enrichment.modoId } : {}),
        ...(share ? { share } : {}),
      };
    });
  }

  function buildStatementMeta(): StatementMetaForImport[] {
    const result: StatementMetaForImport[] = [];
    parseResult.statements.forEach((stmt, stmtIdx) => {
      const mapping = localMappings.find((m) => m.statementIndex === stmtIdx);
      if (!mapping?.accountId) return;
      result.push({
        accountId: mapping.accountId,
        statementIndex: stmtIdx,
        summary: stmt.summary,
        creditCardMetadata: stmt.credit_card_metadata,
        loanMetadata: stmt.loan_metadata,
        periodFrom: stmt.period_from,
        periodTo: stmt.period_to,
        currency: stmt.currency,
        transactionCount: stmt.transactions.length,
        primaryCurrency: mapping.primaryCurrency,
      });
    });
    return result;
  }

  async function handleContinue() {
    setPreparing(true);
    try {
      const transactions = await buildTransactions();
      const preview = await previewImportReconciliation(
        captureMethod,
        transactions.map((item) => {
          const [statementIndex, transactionIndex] = (item.import_key ?? "0:0")
            .split(":")
            .map(Number);
          return {
            statementIndex,
            transactionIndex,
            importedTransaction: item,
          };
        }),
      );
      await trackClientEvent({
        event_name: "reconciliation_started",
        flow: "import",
        step: "reconciliation_preview",
        entry_point: "cta",
        success: true,
        metadata: {
          enriched_rows: transactions.filter((t) => t.modo_id || t.share || (t.tag_ids?.length ?? 0) > 0 || t.notes).length,
          matches_auto: preview.autoMerge.length,
          matches_review: preview.review.length,
          matches_rejected: 0,
        },
      });
      onContinue({
        transactions,
        statementMeta: buildStatementMeta(),
        reconciliationPreview: preview,
      });
    } finally {
      setPreparing(false);
    }
  }

  const allMapped = localMappings.every((m) => m.accountId !== "");
  const totalSelected = Array.from(selections.values()).reduce(
    (acc, s) => acc + s.size,
    0,
  );

  // Track rendered currency selectors so we only show one per account.
  const renderedCurrencySelector = new Set<string>();

  return (
    <div className="space-y-6">
      {totalRows > 0 && (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar movimientos">
            {(Object.keys(REVIEW_FILTER_LABELS) as ReviewFilter[]).map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={reviewFilter === f}
                className={chipToggleClass(reviewFilter === f)}
                onClick={() => setReviewFilter(f)}
              >
                {REVIEW_FILTER_LABELS[f]} · {filterCounts[f]}
              </button>
            ))}
          </div>
          <div className={cn(PANEL_INSET_CLASS, "flex flex-wrap items-center gap-2 p-2")}>
            <span className="px-1 text-xs text-muted-foreground">
              Aplicar a {bulkCount} {reviewFilter === "all" ? "marcadas" : "visibles marcadas"}:
            </span>
            {modos.length > 0 && (
              <Select
                value={bulkModo}
                onValueChange={(v) => {
                  applyBulkEnrichment({ modoId: v === "__none__" ? null : v });
                  setBulkModo("");
                }}
              >
                <SelectTrigger className="h-8 w-auto text-xs" aria-label="Asignar viaje" disabled={bulkCount === 0}>
                  <SelectValue placeholder="Viaje" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin viaje</SelectItem>
                  {modos.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.emoji ? `${m.emoji} ` : ""}
                      {m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(GHOST_BUTTON_CLASS, "h-8 text-xs")}
              disabled={bulkCount === 0}
              onClick={() => setShareTarget("bulk")}
            >
              Compartir con…
            </Button>
            <TagZonePicker
              selectedTagIds={bulkTagIds}
              onSelectedTagIdsChange={setBulkTagIds}
              placeholder="Etiquetar"
              triggerClassName="h-8 w-auto text-xs"
            />
            {bulkTagIds.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(GHOST_BUTTON_CLASS, "h-8 text-xs")}
                disabled={bulkCount === 0}
                onClick={() => {
                  applyBulkEnrichment((cur) => ({ tagIds: [...new Set([...cur.tagIds, ...bulkTagIds])] }));
                  setBulkTagIds([]);
                }}
              >
                Aplicar {bulkTagIds.length === 1 ? "etiqueta" : "etiquetas"}
              </Button>
            )}
            <CategoryZonePicker
              variant="popover"
              categories={categories}
              value={null}
              onValueChange={applyBulkCategory}
              direction="OUTFLOW"
              placeholder="Categoría"
              triggerClassName="h-8 w-auto text-xs"
            />
          </div>
        </div>
      )}

      {allCreditCard ? (
        <MultiCreditCardGroup
          statements={parseResult.statements}
          mappings={localMappings}
          accounts={accounts}
          selections={selections}
          onSelectAccount={(accountId) => {
            parseResult.statements.forEach((_, idx) => updateMapping(idx, accountId));
          }}
          onCreateAccount={() => openCreateDialog(0)}
          onUpdatePrimaryCurrency={updatePrimaryCurrency}
          getDefaultPrimaryCurrency={getDefaultPrimaryCurrency}
          getCurrenciesForAccount={getCurrenciesForAccount}
          onToggleTransaction={toggleTransaction}
          onToggleAll={toggleAllForStatement}
          expandedStatement={expandedStatement}
          onToggleExpanded={(idx) =>
            setExpandedStatement((p) => (p === idx ? null : idx))
          }
          destinatarioMap={mergedDestMap}
          onCreateDestinatario={openDestDialog}
          categories={categories}
          categoryMap={displayCatMap}
          onCategoryChange={handleCategoryChange}
          suggestedKeys={suggestedKeys}
          enrichmentMap={effectiveMap}
          defaultModoKeys={defaultModoKeys}
          modos={modos}
          onEnrichmentChange={patchEnrichment}
          onOpenShare={(stmtIdx, txIdx) => setShareTarget({ stmtIdx, txIdx })}
          visibleByStmt={visibleByStmt}
        />
      ) : (
        parseResult.statements.map((stmt, idx) => {
          const mapping = localMappings.find((m) => m.statementIndex === idx);
          const accountId = mapping?.accountId ?? "";
          const isCreditCard =
            stmt.statement_type === "credit_card" && stmt.credit_card_metadata != null;
          const isLoan = stmt.statement_type === "loan" && stmt.loan_metadata != null;

          let showCurrencySelector = false;
          if (accountId && !renderedCurrencySelector.has(accountId)) {
            const currencies = getCurrenciesForAccount(accountId);
            if (currencies.length > 1) {
              showCurrencySelector = true;
              renderedCurrencySelector.add(accountId);
            }
          }
          const primaryCurrency =
            mapping?.primaryCurrency ?? getDefaultPrimaryCurrency(accountId);
          const accountCurrencies = accountId
            ? getCurrenciesForAccount(accountId)
            : [];

          return (
            <StatementBlock
              key={idx}
              stmt={stmt}
              accounts={accounts}
              accountId={accountId}
              autoMatched={mapping?.autoMatched}
              onSelectAccount={(id) => updateMapping(idx, id)}
              onCreateAccount={() => openCreateDialog(idx)}
              isCreditCard={isCreditCard}
              isLoan={isLoan}
              selections={selections.get(idx) ?? new Set()}
              onToggleTransaction={(txIdx) => toggleTransaction(idx, txIdx)}
              onToggleAll={() => toggleAllForStatement(idx)}
              expanded={expandedStatement === idx}
              onToggleExpanded={() =>
                setExpandedStatement((p) => (p === idx ? null : idx))
              }
              showCurrencySelector={showCurrencySelector}
              currencies={accountCurrencies}
              primaryCurrency={primaryCurrency}
              onPrimaryCurrencyChange={(c) => updatePrimaryCurrency(accountId, c)}
              stmtIdx={idx}
              destinatarioMap={mergedDestMap}
              onCreateDestinatario={(txIdx) => openDestDialog(idx, txIdx)}
              categories={categories}
              categoryMap={displayCatMap}
              onCategoryChange={(txIdx, categoryId) =>
                handleCategoryChange(idx, txIdx, categoryId)
              }
              suggestedKeys={suggestedKeys}
              enrichmentMap={effectiveMap}
              defaultModoKeys={defaultModoKeys}
              modos={modos}
              onEnrichmentChange={(txIdx, patch) => patchEnrichment(idx, txIdx, patch)}
              onOpenShare={(txIdx) => setShareTarget({ stmtIdx: idx, txIdx })}
              visibleIndices={visibleByStmt.get(idx)}
            />
          );
        })
      )}

      <CreateAccountDialog
        statement={parseResult.statements[dialogStatementIndex]}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleAccountCreated}
      />

      {destDialogTarget &&
        (() => {
          const stmt = parseResult.statements[destDialogTarget.stmtIdx];
          const tx = stmt?.transactions[destDialogTarget.txIdx];
          if (!tx) return null;
          return (
            <DestinatarioCreateDialog
              key={`${destDialogTarget.stmtIdx}-${destDialogTarget.txIdx}`}
              open
              onOpenChange={(o) => {
                if (!o) setDestDialogTarget(null);
              }}
              categories={categories}
              rawDescription={tx.description}
              amount={tx.original_amount ?? tx.amount}
              currencyCode={stmt.currency as CurrencyCode}
              onCreated={handleDestinatarioCreated}
              onCancel={() => setDestDialogTarget(null)}
            />
          );
        })()}

      {shareTarget &&
        (() => {
          if (shareTarget === "bulk") {
            return (
              <ImportSharePicker
                key="bulk"
                open
                onOpenChange={(o) => {
                  if (!o) setShareTarget(null);
                }}
                value={null}
                onChange={handleShareChange}
                bulkCount={bulkCount}
              />
            );
          }
          const stmt = parseResult.statements[shareTarget.stmtIdx];
          const tx = stmt?.transactions[shareTarget.txIdx];
          if (!tx) return null;
          const key = `${shareTarget.stmtIdx}-${shareTarget.txIdx}`;
          const current = effectiveMap.get(key) ?? EMPTY_ENRICHMENT;
          const row: SharePreviewRow = {
            description: tx.description,
            amount: tx.amount,
            currency: stmt.currency,
            installment_current: tx.installment_current,
            installment_total: tx.installment_total,
            original_amount: tx.original_amount,
            ea_rate_percent: stmt.credit_card_metadata?.interest_rate ?? null,
          };
          return (
            <ImportSharePicker
              key={key}
              open
              onOpenChange={(o) => {
                if (!o) setShareTarget(null);
              }}
              value={current.share}
              onChange={handleShareChange}
              modo={current.modoId ? (modos.find((m) => m.id === current.modoId) ?? null) : null}
              row={row}
            />
          );
        })()}

      <WizardActionBar>
        <Button variant="outline" onClick={onBack}>
          Volver
        </Button>
        <Button onClick={handleContinue} disabled={!allMapped || preparing}>
          {preparing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Analizando...
            </>
          ) : (
            `Continuar · ${totalSelected} ${totalSelected === 1 ? "movimiento" : "movimientos"}`
          )}
        </Button>
      </WizardActionBar>
    </div>
  );
}

function UnifiedStatementCard({
  accounts,
  accountId,
  autoMatched,
  onSelectAccount,
  onCreateAccount,
  showCurrencySelector,
  currencies,
  primaryCurrency,
  onPrimaryCurrencyChange,
}: {
  accounts: Account[];
  accountId: string;
  autoMatched?: boolean;
  onSelectAccount: (id: string) => void;
  onCreateAccount: () => void;
  showCurrencySelector: boolean;
  currencies: string[];
  primaryCurrency: string;
  onPrimaryCurrencyChange: (c: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1">
        <AccountAssignControl
          accounts={accounts}
          accountId={accountId}
          autoMatched={autoMatched}
          onSelect={onSelectAccount}
          onCreate={onCreateAccount}
          variant="pill"
        />
      </div>
      {showCurrencySelector && currencies.length > 1 && (
        <Select value={primaryCurrency} onValueChange={onPrimaryCurrencyChange}>
          <SelectTrigger className="h-9 w-auto shrink-0 gap-1 rounded-full border-z-brass/30 bg-z-brass/12 px-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-z-brass">
            <SelectValue />
          </SelectTrigger>
          <SelectContent align="end">
            {currencies.map((cur) => (
              <SelectItem key={cur} value={cur} className="text-xs">
                {cur}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

function StatementBlock({
  stmt,
  accounts,
  accountId,
  autoMatched,
  onSelectAccount,
  onCreateAccount,
  isCreditCard,
  isLoan,
  selections,
  onToggleTransaction,
  onToggleAll,
  expanded,
  onToggleExpanded,
  showCurrencySelector,
  currencies,
  primaryCurrency,
  onPrimaryCurrencyChange,
  stmtIdx,
  destinatarioMap,
  onCreateDestinatario,
  categories,
  categoryMap,
  onCategoryChange,
  suggestedKeys,
  enrichmentMap,
  defaultModoKeys,
  modos,
  onEnrichmentChange,
  onOpenShare,
  visibleIndices,
}: {
  stmt: ParseResponse["statements"][number];
  accounts: Account[];
  accountId: string;
  autoMatched?: boolean;
  onSelectAccount: (id: string) => void;
  onCreateAccount: () => void;
  isCreditCard: boolean;
  isLoan: boolean;
  selections: Set<number>;
  onToggleTransaction: (txIdx: number) => void;
  onToggleAll: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  showCurrencySelector: boolean;
  currencies: string[];
  primaryCurrency: string;
  onPrimaryCurrencyChange: (c: string) => void;
  stmtIdx: number;
  destinatarioMap: Map<string, { id: string; name: string }>;
  onCreateDestinatario: (txIdx: number) => void;
  categories: CategoryWithChildren[];
  categoryMap: Map<string, string | null>;
  onCategoryChange: (txIdx: number, categoryId: string | null) => void;
  suggestedKeys: ReadonlySet<string>;
  enrichmentMap: Map<string, RowEnrichment>;
  defaultModoKeys: ReadonlySet<string>;
  modos: ModoWithParticipants[];
  onEnrichmentChange: (txIdx: number, patch: Partial<RowEnrichment>) => void;
  onOpenShare: (txIdx: number) => void;
  visibleIndices?: ReadonlySet<number>;
}) {
  return (
    <div className="space-y-3">
      <UnifiedStatementCard
        accounts={accounts}
        accountId={accountId}
        autoMatched={autoMatched}
        onSelectAccount={onSelectAccount}
        onCreateAccount={onCreateAccount}
        showCurrencySelector={showCurrencySelector}
        currencies={currencies}
        primaryCurrency={primaryCurrency}
        onPrimaryCurrencyChange={onPrimaryCurrencyChange}
      />

      {isCreditCard && stmt.credit_card_metadata ? (
        <>
          <SectionDivider label="Por pagar" />
          <CreditCardSummary
            metadata={stmt.credit_card_metadata}
            summary={stmt.summary ?? null}
            transactionCount={stmt.transactions.length}
            currency={stmt.currency as CurrencyCode}
          />
        </>
      ) : isLoan ? (
        <StatementSummaryCard statement={stmt} />
      ) : stmt.summary != null || stmt.transactions.length > 0 ? (
        <>
          <SectionDivider label="Resumen del periodo" />
          <SavingsSummary
            summary={stmt.summary ?? null}
            transactions={stmt.transactions}
            currency={stmt.currency as CurrencyCode}
            periodFrom={stmt.period_from}
            periodTo={stmt.period_to}
          />
        </>
      ) : null}

      <SectionDivider label="Movimientos" />

      <div className="space-y-2 rounded-2xl border border-white/6 bg-z-surface-2/60 p-3">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex w-full items-center justify-between gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-white/5"
          aria-expanded={expanded}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-z-white">
              {selections.size} de {stmt.transactions.length} seleccionadas
            </p>
            <p className="text-xs text-z-sage-dark">
              {expanded ? "Ocultar detalle" : "Ver y ajustar selección"}
            </p>
          </div>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-z-sage-dark transition-transform",
              expanded && "rotate-180",
            )}
          />
        </button>

        {expanded && stmt.transactions.length > 0 && (
          <ParsedTransactionTable
            transactions={stmt.transactions}
            currency={stmt.currency}
            selected={selections}
            onToggle={onToggleTransaction}
            onToggleAll={onToggleAll}
            stmtIdx={stmtIdx}
            destinatarioMap={destinatarioMap}
            onCreateDestinatario={onCreateDestinatario}
            categories={categories}
            categoryMap={categoryMap}
            onCategoryChange={onCategoryChange}
            suggestedKeys={suggestedKeys}
            enrichmentMap={enrichmentMap}
            defaultModoKeys={defaultModoKeys}
            modos={modos}
            onEnrichmentChange={onEnrichmentChange}
            onOpenShare={onOpenShare}
            visibleIndices={visibleIndices}
          />
        )}
      </div>
    </div>
  );
}

function MultiCreditCardGroup({
  statements,
  mappings,
  accounts,
  selections,
  onSelectAccount,
  onCreateAccount,
  onUpdatePrimaryCurrency,
  getDefaultPrimaryCurrency,
  getCurrenciesForAccount,
  onToggleTransaction,
  onToggleAll,
  expandedStatement,
  onToggleExpanded,
  destinatarioMap,
  onCreateDestinatario,
  categories,
  categoryMap,
  onCategoryChange,
  suggestedKeys,
  enrichmentMap,
  defaultModoKeys,
  modos,
  onEnrichmentChange,
  onOpenShare,
  visibleByStmt,
}: {
  statements: ParseResponse["statements"];
  mappings: StatementAccountMapping[];
  accounts: Account[];
  selections: Map<number, Set<number>>;
  onSelectAccount: (accountId: string) => void;
  onCreateAccount: () => void;
  onUpdatePrimaryCurrency: (accountId: string, currency: string) => void;
  getDefaultPrimaryCurrency: (accountId: string) => string;
  getCurrenciesForAccount: (accountId: string) => string[];
  onToggleTransaction: (stmtIdx: number, txIdx: number) => void;
  onToggleAll: (stmtIdx: number) => void;
  expandedStatement: number | null;
  onToggleExpanded: (stmtIdx: number) => void;
  destinatarioMap: Map<string, { id: string; name: string }>;
  onCreateDestinatario: (stmtIdx: number, txIdx: number) => void;
  categories: CategoryWithChildren[];
  categoryMap: Map<string, string | null>;
  onCategoryChange: (stmtIdx: number, txIdx: number, categoryId: string | null) => void;
  suggestedKeys: ReadonlySet<string>;
  enrichmentMap: Map<string, RowEnrichment>;
  defaultModoKeys: ReadonlySet<string>;
  modos: ModoWithParticipants[];
  onEnrichmentChange: (stmtIdx: number, txIdx: number, patch: Partial<RowEnrichment>) => void;
  onOpenShare: (stmtIdx: number, txIdx: number) => void;
  visibleByStmt: Map<number, Set<number>>;
}) {
  const firstMapping = mappings[0];
  const accountId = firstMapping?.accountId ?? "";
  const autoMatched = mappings.every((m) => m.autoMatched);
  const primaryCurrency =
    firstMapping?.primaryCurrency ?? getDefaultPrimaryCurrency(accountId);
  const currencies = accountId ? getCurrenciesForAccount(accountId) : [];
  const totalSelected = statements.reduce(
    (sum, _, idx) => sum + (selections.get(idx)?.size ?? 0),
    0,
  );
  const totalTx = statements.reduce((sum, s) => sum + s.transactions.length, 0);

  return (
    <div className="space-y-3">
      <UnifiedStatementCard
        accounts={accounts}
        accountId={accountId}
        autoMatched={autoMatched}
        onSelectAccount={onSelectAccount}
        onCreateAccount={onCreateAccount}
        showCurrencySelector={currencies.length > 1}
        currencies={currencies}
        primaryCurrency={primaryCurrency}
        onPrimaryCurrencyChange={(v) => onUpdatePrimaryCurrency(accountId, v)}
      />

      <SectionDivider label="Por pagar" />
      <div className="space-y-2">
        {statements.map((stmt, i) =>
          stmt.credit_card_metadata ? (
            <CreditCardStackCard
              key={`${stmt.currency}-${i}`}
              currency={stmt.currency as CurrencyCode}
              metadata={stmt.credit_card_metadata}
              summary={stmt.summary ?? null}
              transactionCount={stmt.transactions.length}
            />
          ) : null,
        )}
      </div>

      <SectionDivider label="Movimientos" />
      <div className="space-y-2 rounded-2xl border border-white/6 bg-z-surface-2/60 p-3">
        <div className="px-2 py-1.5">
          <p className="text-sm font-semibold text-z-white">
            {totalSelected} de {totalTx} seleccionadas
          </p>
          <p className="text-xs text-z-sage-dark">
            Expande cada moneda para ajustar su selección.
          </p>
        </div>
        {statements.map((stmt, idx) => {
          const expanded = expandedStatement === idx;
          const sel = selections.get(idx) ?? new Set();
          return (
            <div key={idx} className="rounded-xl border border-white/6 bg-z-surface-3/40">
              <button
                type="button"
                onClick={() => onToggleExpanded(idx)}
                className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-white/5"
                aria-expanded={expanded}
              >
                <span className="flex items-baseline gap-2 min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-z-brass">
                    {stmt.currency}
                  </span>
                  <span className="text-xs text-z-sage-light">
                    {sel.size} de {stmt.transactions.length} seleccionadas
                  </span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-z-sage-dark transition-transform",
                    expanded && "rotate-180",
                  )}
                />
              </button>
              {expanded && stmt.transactions.length > 0 && (
                <div className="border-t border-white/6 p-2">
                  <ParsedTransactionTable
                    transactions={stmt.transactions}
                    currency={stmt.currency}
                    selected={sel}
                    onToggle={(txIdx) => onToggleTransaction(idx, txIdx)}
                    onToggleAll={() => onToggleAll(idx)}
                    stmtIdx={idx}
                    destinatarioMap={destinatarioMap}
                    onCreateDestinatario={(txIdx) => onCreateDestinatario(idx, txIdx)}
                    categories={categories}
                    categoryMap={categoryMap}
                    onCategoryChange={(txIdx, categoryId) => onCategoryChange(idx, txIdx, categoryId)}
                    suggestedKeys={suggestedKeys}
                    enrichmentMap={enrichmentMap}
                    defaultModoKeys={defaultModoKeys}
                    modos={modos}
                    onEnrichmentChange={(txIdx, patch) => onEnrichmentChange(idx, txIdx, patch)}
                    onOpenShare={(txIdx) => onOpenShare(idx, txIdx)}
                    visibleIndices={visibleByStmt.get(idx)}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
