"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Check,
  X,
  Loader2,
  Mail,
  AlertTriangle,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  approveEmailTransaction,
  checkEmailReconciliation,
  dismissEmailTransaction,
  type ReconciliationCandidatePreview,
} from "@/actions/email-ingest";
import { EmailReconcileDialog } from "@/components/import/email-reconcile-dialog";
import { getEmailPatternLabel } from "@/lib/email-ingest/pattern-labels";
import { formatDate } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/currency";
import type { ParsedEmailTransaction } from "@/lib/parsers/bancolombia-email";
import { resolveSuggestedEmailAccountId } from "@/lib/email-ingest/account-matching";
import type { Account, PendingEmailTransaction } from "@/types/domain";

interface PendingEmailTransactionsProps {
  transactions: PendingEmailTransaction[];
  accounts: Account[];
}

export function PendingEmailTransactions({
  transactions: initialTransactions,
  accounts,
}: PendingEmailTransactionsProps) {
  const router = useRouter();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [accountOverrides, setAccountOverrides] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reconMatch, setReconMatch] = useState<{
    pendingId: string;
    candidate: ReconciliationCandidatePreview;
  } | null>(null);
  const [reconLoading, setReconLoading] = useState(false);
  const [, startTransition] = useTransition();

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  const accountOptions = useMemo(
    () =>
      accounts.map((acc) => (
        <SelectItem key={acc.id} value={acc.id}>
          {acc.name} ({acc.currency_code})
        </SelectItem>
      )),
    [accounts]
  );

  // Client-side fallback matching for pending rows that lack a suggested_account_id
  const clientMatches = useMemo(() => {
    const matches: Record<string, string> = {};
    for (const tx of initialTransactions) {
      if (tx.suggested_account_id) continue;
      const parsed = tx.parsed_data as unknown as ParsedEmailTransaction | null;
      if (!parsed?.card_last4) continue;
      const matched = resolveSuggestedEmailAccountId({
        accounts,
        parsed,
        defaultAccountId: null,
      });
      if (matched) matches[tx.id] = matched;
    }
    return matches;
  }, [initialTransactions, accounts]);

  function resolveAccount(tx: PendingEmailTransaction): Account | null {
    const id = accountOverrides[tx.id] ?? tx.suggested_account_id ?? clientMatches[tx.id];
    return id ? accountMap.get(id) ?? null : null;
  }

  function handleAccountChange(txId: string, accountId: string) {
    setAccountOverrides((prev) => ({ ...prev, [txId]: accountId }));
  }

  function removeOverride(id: string) {
    setAccountOverrides((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  const resolveAccountId = useCallback(
    (tx: PendingEmailTransaction): string | undefined =>
      accountOverrides[tx.id] ?? tx.suggested_account_id ?? clientMatches[tx.id] ?? undefined,
    [accountOverrides, clientMatches]
  );

  // Transactions that have a resolved account (importable)
  const importableIds = useMemo(
    () => new Set(transactions.filter((tx) => resolveAccountId(tx)).map((tx) => tx.id)),
    [transactions, resolveAccountId]
  );

  const selectedImportable = useMemo(
    () => [...selected].filter((id) => importableIds.has(id)),
    [selected, importableIds]
  );

  if (transactions.length === 0) return null;

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === importableIds.size) {
      setSelected(new Set());
    } else {
      setSelected(new Set(importableIds));
    }
  }

  function clearPending(pendingId: string) {
    setTransactions((prev) => prev.filter((t) => t.id !== pendingId));
    removeOverride(pendingId);
    setSelected((prev) => { const next = new Set(prev); next.delete(pendingId); return next; });
  }

  function handleApprove(pendingId: string) {
    const override = accountOverrides[pendingId] ?? clientMatches[pendingId];
    setLoadingId(pendingId);
    startTransition(async () => {
      try {
        // Check for reconciliation candidates before importing
        const reconResult = await checkEmailReconciliation(pendingId, override);
        if (reconResult.success && reconResult.data) {
          setLoadingId(null);
          setReconMatch({ pendingId, candidate: reconResult.data.candidate });
          return;
        }

        // No match (or check failed) — import directly
        const result = await approveEmailTransaction(pendingId, override);
        setLoadingId(null);
        if (result.success) {
          clearPending(pendingId);
          router.refresh();
          toast.success("Transacción importada");
        } else {
          toast.error(result.error);
        }
      } catch {
        setLoadingId(null);
        toast.error("Error al importar. Inténtalo de nuevo.");
      }
    });
  }

  function handleReconChoice(reconcile: boolean) {
    if (!reconMatch) return;
    const { pendingId, candidate } = reconMatch;
    const override = accountOverrides[pendingId] ?? clientMatches[pendingId];
    setReconMatch(null);
    setReconLoading(true);
    startTransition(async () => {
      try {
        const result = await approveEmailTransaction(
          pendingId,
          override,
          reconcile ? candidate.id : undefined,
        );
        setReconLoading(false);
        if (result.success) {
          clearPending(pendingId);
          router.refresh();
          toast.success(reconcile ? "Transacción reconciliada" : "Transacción importada");
        } else {
          toast.error(result.error);
        }
      } catch {
        setReconLoading(false);
        toast.error("Error al importar. Inténtalo de nuevo.");
      }
    });
  }

  function handleBulkApprove() {
    const ids = selectedImportable;
    if (ids.length === 0) return;

    setBulkLoading(true);
    startTransition(async () => {
      let imported = 0;
      let failed = 0;
      let needsReview = 0;
      const done: string[] = [];

      for (const id of ids) {
        const tx = transactions.find((t) => t.id === id);
        if (!tx) continue;
        const override = accountOverrides[id] ?? clientMatches[id];
        try {
          // Same duplicate check as the single-row Importar. Rows with a
          // candidate stay pending — bulk never decides a merge silently;
          // the user resolves those one by one with the full prompt.
          const reconResult = await checkEmailReconciliation(id, override);
          if (reconResult.success && reconResult.data) {
            needsReview++;
            continue;
          }
          const result = await approveEmailTransaction(id, override);
          if (result.success) {
            imported++;
            done.push(id);
          } else {
            failed++;
          }
        } catch {
          // Action likely completed server-side
          imported++;
          done.push(id);
        }
      }

      setTransactions((prev) => prev.filter((t) => !done.includes(t.id)));
      setSelected(new Set());
      setBulkLoading(false);
      router.refresh();

      if (failed === 0 && needsReview === 0) {
        toast.success(`${imported} transacciones importadas`);
      } else if (needsReview > 0) {
        toast.warning(
          `${imported} importadas · ${needsReview} con posible duplicado — impórtalas una por una${failed > 0 ? ` · ${failed} con error` : ""}`,
        );
      } else {
        toast.warning(`${imported} importadas, ${failed} con error`);
      }
    });
  }

  function handleDismiss(pendingId: string) {
    setLoadingId(pendingId);
    startTransition(async () => {
      try {
        const result = await dismissEmailTransaction(pendingId);
        setLoadingId(null);
        if (result.success) {
          setTransactions((prev) => prev.filter((t) => t.id !== pendingId));
          removeOverride(pendingId);
          setSelected((prev) => { const next = new Set(prev); next.delete(pendingId); return next; });
        } else {
          toast.error(result.error);
        }
      } catch {
        setLoadingId(null);
        setTransactions((prev) => prev.filter((t) => t.id !== pendingId));
        removeOverride(pendingId);
        setSelected((prev) => { const next = new Set(prev); next.delete(pendingId); return next; });
      }
    });
  }

  return (
    <Card className="border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-z-sage-dark" />
            <CardTitle className="text-base">Pendientes por correo</CardTitle>
            <span className="rounded-full bg-z-brass/20 px-2 py-0.5 text-xs font-semibold text-z-brass">
              {transactions.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/import/correo"
              className="inline-flex h-7 items-center gap-1 text-xs font-semibold text-z-brass hover:underline"
            >
              Abrir bandeja
              <ArrowRight className="size-3.5" />
            </Link>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-muted-foreground"
              onClick={toggleAll}
              disabled={bulkLoading || importableIds.size === 0}
            >
              {selected.size === importableIds.size && importableIds.size > 0
                ? "Deseleccionar"
                : "Seleccionar todo"}
            </Button>
            {selectedImportable.length > 0 && (
              <Button
                size="sm"
                className="h-7 gap-1.5 bg-z-income/15 text-xs font-medium text-z-income hover:bg-z-income/25"
                onClick={handleBulkApprove}
                disabled={bulkLoading}
              >
                {bulkLoading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <CheckCheck className="size-3.5" />
                )}
                Importar {selectedImportable.length}
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-white/6">
          {transactions.map((tx) => {
            const parsed = tx.parsed_data as unknown as ParsedEmailTransaction;
            const merchant =
              parsed.merchant ?? parsed.destination ?? "Transacción";
            const isInflow = parsed.direction === "INFLOW";
            const isLoading = loadingId === tx.id;
            const pattern = getEmailPatternLabel(parsed.pattern_type);
            const PatternIcon = pattern.icon;
            const account = resolveAccount(tx);
            const hasAccount = !!account;

            return (
              <div
                key={tx.id}
                className="px-6 py-4 transition-colors hover:bg-white/2"
              >
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selected.has(tx.id)}
                    onCheckedChange={() => toggleSelected(tx.id)}
                    disabled={bulkLoading || !hasAccount}
                    className="shrink-0"
                  />
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
                      isInflow
                        ? "bg-z-income/10 text-z-income"
                        : "bg-white/5 text-muted-foreground"
                    }`}
                  >
                    {isInflow ? (
                      <ArrowDownLeft className="size-4" />
                    ) : (
                      <ArrowUpRight className="size-4" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{merchant}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      <span>{formatDate(parsed.transaction_date)}</span>
                      <span>·</span>
                      <span>{parsed.transaction_time}</span>
                      {parsed.card_last4 && (
                        <>
                          <span>·</span>
                          <span>
                            {parsed.card_type === "Cta" ? "Cuenta" : parsed.card_type} *{parsed.card_last4}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <p
                    className={`shrink-0 text-sm font-semibold tabular-nums ${
                      isInflow ? "text-z-income" : ""
                    }`}
                  >
                    {isInflow ? "+" : ""}
                    {formatCurrency(parsed.amount, "COP")}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-full border border-white/6 bg-white/3 px-2.5 py-1 text-xs text-muted-foreground">
                      <PatternIcon className="size-3" />
                      <span>{pattern.label}</span>
                    </div>
                    {(tx.category_id || (tx.tag_ids?.length ?? 0) > 0) && (
                      <Link
                        href="/import/correo"
                        className="rounded-full border border-z-brass/25 bg-z-brass/8 px-2.5 py-1 text-xs text-z-brass"
                      >
                        {tx.category_id ? "Categorizada" : "Etiquetada"}
                        {tx.category_id && (tx.tag_ids?.length ?? 0) > 0
                          ? ` · ${tx.tag_ids.length} etiq.`
                          : ""}
                      </Link>
                    )}

                    <Select
                      value={hasAccount ? account.id : undefined}
                      onValueChange={(v) => handleAccountChange(tx.id, v)}
                    >
                      <SelectTrigger
                        className={`h-7 w-auto gap-1.5 rounded-full px-2.5 text-xs ${
                          hasAccount
                            ? "border-white/6 bg-white/3 text-muted-foreground"
                            : "border-amber-400/30 bg-amber-400/5 text-amber-400"
                        }`}
                      >
                        {!hasAccount && <AlertTriangle className="size-3" />}
                        <SelectValue placeholder="Sin cuenta" />
                      </SelectTrigger>
                      <SelectContent>{accountOptions}</SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => handleDismiss(tx.id)}
                      disabled={isLoading}
                    >
                      <X className="size-3.5" />
                      Descartar
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 gap-1.5 bg-z-income/15 text-xs font-medium text-z-income hover:bg-z-income/25"
                      onClick={() => handleApprove(tx.id)}
                      disabled={isLoading || !hasAccount}
                      title={!hasAccount ? "Selecciona una cuenta primero" : undefined}
                    >
                      {isLoading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Check className="size-3.5" />
                      )}
                      Importar
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      <EmailReconcileDialog
        candidate={reconMatch?.candidate ?? null}
        currency="COP"
        loading={reconLoading}
        onClose={() => setReconMatch(null)}
        onChoose={handleReconChoice}
      />
    </Card>
  );
}
