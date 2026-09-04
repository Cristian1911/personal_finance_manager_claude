"use client";

import { useCallback, useMemo, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useEmailQueueActions } from "@/hooks/use-email-queue-actions";
import { EmailReconcileDialog } from "@/components/import/email-reconcile-dialog";
import {
  EmailAccountSelect,
  EmailProductDialog,
  useEmailProductResolver,
} from "@/components/import/email-product-resolver";
import { getEmailPatternLabel } from "@/lib/email-ingest/pattern-labels";
import { CONFIRM_BUTTON_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils/date";
import { formatCurrency } from "@/lib/utils/currency";
import type { ParsedEmailTransaction } from "@/lib/parsers/bancolombia-email";
import {
  pickPendingEmailAccountId,
  resolveEmailAccountMatch,
  type EmailAccountMatch,
} from "@/lib/email-ingest/account-matching";
import type { Account, PendingEmailTransaction } from "@/types/domain";

interface PendingEmailTransactionsProps {
  transactions: PendingEmailTransaction[];
  accounts: Account[];
}

export function PendingEmailTransactions({
  transactions: initialTransactions,
  accounts: initialAccounts,
}: PendingEmailTransactionsProps) {
  const router = useRouter();
  const [transactions, setTransactions] = useState(initialTransactions);
  const [accountOverrides, setAccountOverrides] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const refresh = useCallback(() => router.refresh(), [router]);

  // "Producto no registrado": registering a card/account once points every
  // queued alert from it at the new account.
  const applyResolution = useCallback((accountId: string, pendingIds: string[]) => {
    setAccountOverrides((prev) => {
      const next = { ...prev };
      for (const id of pendingIds) next[id] = accountId;
      return next;
    });
  }, []);
  const resolver = useEmailProductResolver({
    accounts: initialAccounts,
    onResolved: applyResolution,
    afterChange: refresh,
  });
  const accounts = resolver.accounts;

  const accountMap = useMemo(
    () => new Map(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  // Match every row's mask against the accounts the client can see — this is
  // what tells a registered card from a brand-new one.
  const matchById = useMemo(() => {
    const matches = new Map<string, EmailAccountMatch>();
    for (const tx of transactions) {
      const parsed = tx.parsed_data as unknown as ParsedEmailTransaction | null;
      if (!parsed) continue;
      matches.set(
        tx.id,
        resolveEmailAccountMatch({ accounts, parsed, defaultAccountId: null }),
      );
    }
    return matches;
  }, [transactions, accounts]);

  const resolveAccountId = useCallback(
    (pendingId: string): string | undefined =>
      pickPendingEmailAccountId({
        override: accountOverrides[pendingId],
        suggested: transactions.find((tx) => tx.id === pendingId)?.suggested_account_id,
        match: matchById.get(pendingId) ?? null,
      }) ?? undefined,
    [accountOverrides, transactions, matchById]
  );

  function resolveAccount(tx: PendingEmailTransaction): Account | null {
    const id = resolveAccountId(tx.id);
    return id ? accountMap.get(id) ?? null : null;
  }

  function handleAccountChange(txId: string, accountId: string) {
    setAccountOverrides((prev) => ({ ...prev, [txId]: accountId }));
  }

  // Transactions that have a resolved account (importable)
  const importableIds = useMemo(
    () => new Set(transactions.filter((tx) => resolveAccountId(tx.id)).map((tx) => tx.id)),
    [transactions, resolveAccountId]
  );

  const selectedImportable = useMemo(
    () => [...selected].filter((id) => importableIds.has(id)),
    [selected, importableIds]
  );

  const clearPending = useCallback((pendingId: string) => {
    setTransactions((prev) => prev.filter((t) => t.id !== pendingId));
    setAccountOverrides((prev) => {
      const next = { ...prev };
      delete next[pendingId];
      return next;
    });
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(pendingId);
      return next;
    });
  }, []);

  const {
    busyId,
    bulkLoading,
    isPending,
    reconMatch,
    closeRecon,
    importOne,
    chooseRecon,
    dismiss,
    bulkImport,
  } = useEmailQueueActions({
    resolveAccountId,
    onProcessed: clearPending,
    afterChange: refresh,
  });

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

  function handleBulkApprove() {
    bulkImport(selectedImportable);
    // Rows that need the duplicate prompt stay in the list; don't leave them
    // checked or "Importar N" would just replay the same warning.
    setSelected(new Set());
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
                className={cn(CONFIRM_BUTTON_CLASS, "h-7 gap-1.5 text-xs font-medium")}
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
            const isLoading = busyId === tx.id;
            const pattern = getEmailPatternLabel(parsed.pattern_type);
            const PatternIcon = pattern.icon;
            const account = resolveAccount(tx);
            const hasAccount = !!account;
            const match = matchById.get(tx.id) ?? null;
            const unrecognized = !hasAccount && match?.status === "unrecognized";

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
                    {formatCurrency(parsed.amount, parsed.currency ?? "COP")}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 rounded-full border border-white/6 bg-white/3 px-2.5 py-1 text-xs text-muted-foreground">
                      <PatternIcon className="size-3" />
                      <span>{pattern.label}</span>
                    </div>
                    {tx.conflict_transaction_id && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-z-alert/30 bg-z-alert/5 px-2.5 py-1 text-xs text-z-alert">
                        <AlertTriangle className="size-3" />
                        Posible duplicado
                      </span>
                    )}
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

                    <EmailAccountSelect
                      accounts={accounts}
                      value={hasAccount ? account.id : undefined}
                      match={match}
                      product={parsed}
                      onChange={(v) => handleAccountChange(tx.id, v)}
                      onRegister={() => resolver.openFor(parsed, tx.id)}
                      disabled={bulkLoading}
                      triggerClassName="h-7 w-auto gap-1.5 rounded-full border-white/6 bg-white/3 px-2.5 text-xs text-muted-foreground"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                      onClick={() => dismiss(tx.id)}
                      disabled={isLoading}
                    >
                      <X className="size-3.5" />
                      Descartar
                    </Button>
                    <Button
                      size="sm"
                      className={cn(CONFIRM_BUTTON_CLASS, "h-7 gap-1.5 text-xs font-medium")}
                      onClick={() =>
                        hasAccount
                          ? importOne(tx.id)
                          : unrecognized && resolver.openFor(parsed, tx.id)
                      }
                      disabled={isLoading || (!hasAccount && !unrecognized)}
                      title={
                        !hasAccount
                          ? unrecognized
                            ? "Registra el producto para importar"
                            : "Selecciona una cuenta primero"
                          : undefined
                      }
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
        loading={isPending}
        onClose={closeRecon}
        onChoose={chooseRecon}
      />
      <EmailProductDialog
        product={resolver.product}
        accounts={accounts}
        onClose={resolver.close}
        onResolved={resolver.handleResolved}
      />
    </Card>
  );
}
