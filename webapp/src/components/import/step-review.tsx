"use client";

import { useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatementSummaryCard } from "./statement-summary-card";
import { CreateAccountDialog } from "./create-account-dialog";
import type { Account } from "@/types/domain";
import type { ParseResponse, StatementAccountMapping } from "@/types/import";

export function StepReview({
  parseResult,
  accounts,
  mappings,
  onConfirm,
  onBack,
  onAccountCreated,
}: {
  parseResult: ParseResponse;
  accounts: Account[];
  mappings: StatementAccountMapping[];
  onConfirm: (mappings: StatementAccountMapping[]) => void;
  onBack: () => void;
  onAccountCreated: (account: Account) => void;
}) {
  const [localMappings, setLocalMappings] =
    useState<StatementAccountMapping[]>(mappings);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogStatementIndex, setDialogStatementIndex] = useState(0);

  // Sync mappings from parent when they change (e.g. after account creation triggers re-match)
  const [prevMappings, setPrevMappings] = useState(mappings);
  if (mappings !== prevMappings) {
    setPrevMappings(mappings);
    setLocalMappings((local) =>
      mappings.map((m) => {
        const localEntry = local.find((l) => l.statementIndex === m.statementIndex);
        // If parent auto-matched a previously unmatched statement, use the new match
        if (m.autoMatched && localEntry && !localEntry.accountId) {
          return m;
        }
        // Keep manual selections
        if (localEntry && localEntry.accountId && !localEntry.autoMatched) {
          return localEntry;
        }
        return m;
      })
    );
  }

  function updateMapping(index: number, accountId: string) {
    setLocalMappings((prev) =>
      prev.map((m) =>
        m.statementIndex === index
          ? { ...m, accountId, autoMatched: false }
          : m
      )
    );
  }

  function updatePrimaryCurrency(accountId: string, currency: string) {
    setLocalMappings((prev) =>
      prev.map((m) => (m.accountId === accountId ? { ...m, primaryCurrency: currency } : m))
    );
  }

  // Returns the set of distinct currencies mapped to a given accountId
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

  // Returns the default primary currency for an account (most transactions, preferring COP)
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

  function openCreateDialog(stmtIndex: number) {
    setDialogStatementIndex(stmtIndex);
    setDialogOpen(true);
  }

  function handleAccountCreated(account: Account) {
    onAccountCreated(account);
    // Auto-select the new account for the statement that triggered creation
    updateMapping(dialogStatementIndex, account.id);
  }

  const allMapped = localMappings.every((m) => m.accountId !== "");

  // Track which accountIds have already rendered a currency selector
  const renderedCurrencySelector = new Set<string>();

  return (
    <div className="space-y-6">
      {parseResult.statements.map((stmt, idx) => {
        const mapping = localMappings.find((m) => m.statementIndex === idx);
        const accountId = mapping?.accountId ?? "";

        // Determine if we should show the currency selector for this statement
        // Only show on the first statement mapped to a given account (no duplication)
        let showCurrencySelector = false;
        if (accountId && !renderedCurrencySelector.has(accountId)) {
          const accountCurrencies = getCurrenciesForAccount(accountId);
          if (accountCurrencies.length > 1) {
            showCurrencySelector = true;
            renderedCurrencySelector.add(accountId);
          }
        }

        const primaryCurrency =
          mapping?.primaryCurrency ?? getDefaultPrimaryCurrency(accountId);
        const accountCurrencies = accountId ? getCurrenciesForAccount(accountId) : [];

        return (
          <div key={idx} className="space-y-3">
            <StatementSummaryCard statement={stmt} />

            <div className="space-y-2 pl-1">
              <Label>Asignar a cuenta</Label>
              <div className="flex items-center gap-2">
                <Select
                  value={accountId}
                  onValueChange={(val) => updateMapping(idx, val)}
                >
                  <SelectTrigger className="w-full max-w-xs">
                    <SelectValue placeholder="Seleccionar cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name}
                        {acc.mask ? ` (****${acc.mask})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon-sm"
                  onClick={() => openCreateDialog(idx)}
                  aria-label="Crear cuenta"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                {mapping?.autoMatched && (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    (autodetectada)
                  </span>
                )}
              </div>
              {showCurrencySelector && accountCurrencies.length > 1 && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-muted-foreground">Moneda principal</span>
                  <Select
                    value={primaryCurrency}
                    onValueChange={(val) => updatePrimaryCurrency(accountId, val)}
                  >
                    <SelectTrigger className="h-7 w-28 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {accountCurrencies.map((cur) => (
                        <SelectItem key={cur} value={cur} className="text-xs">
                          {cur}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {accountId && (
                <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1 mt-1">
                  <RefreshCw className="h-3 w-3" />
                  Los datos de esta cuenta se actualizaran con el extracto
                </p>
              )}
            </div>
          </div>
        );
      })}

      <CreateAccountDialog
        statement={parseResult.statements[dialogStatementIndex]}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleAccountCreated}
      />

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onBack}>
          Volver
        </Button>
        <Button onClick={() => onConfirm(localMappings)} disabled={!allMapped}>
          Continuar
        </Button>
      </div>
    </div>
  );
}
