"use client";

import { useState } from "react";
import type { DebtAccount, ScenarioResult, ScenarioStrategy } from "@zeta/shared";
import type { CurrencyCode } from "@zeta/shared";
import type { PlannerAction, ScenarioState } from "../scenario-planner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils/currency";
import {
  Mountain,
  Snowflake,
  ListOrdered,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  CalendarCheck,
} from "lucide-react";

interface Props {
  accounts: DebtAccount[];
  scenario: ScenarioState;
  scenarioIndex: number;
  result: ScenarioResult | undefined;
  dispatch: React.Dispatch<PlannerAction>;
}

interface StrategyCardProps {
  value: ScenarioStrategy;
  selected: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}

function StrategyCard({ selected, icon, title, description, onClick }: StrategyCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
      className={[
        "flex flex-col gap-1.5 rounded-lg border p-4 cursor-pointer select-none transition-colors",
        selected
          ? "border-primary ring-2 ring-primary/20 bg-primary/5"
          : "border-border hover:border-primary/50 hover:bg-muted/50",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <span className="text-primary">{icon}</span>
        <span className="font-semibold text-sm">{title}</span>
        {selected && (
          <Badge className="ml-auto text-xs px-1.5 py-0" variant="default">
            Activo
          </Badge>
        )}
      </div>
      <p className="text-xs text-muted-foreground leading-snug">{description}</p>
    </div>
  );
}

function formatDebtFreeDate(dateStr: string): string {
  // dateStr is "YYYY-MM"
  const [year, mon] = dateStr.split("-");
  const date = new Date(Number(year), Number(mon) - 1, 1);
  return date.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}

export function AllocateStep({
  accounts,
  scenario,
  scenarioIndex,
  result,
  dispatch,
}: Props) {
  // Derive currency from first account (all should match)
  const currency: CurrencyCode = accounts[0]?.currency ?? "COP";

  // Local custom priority state — initialized when user switches to "custom"
  const [customPriority, setCustomPriority] = useState<string[]>(
    scenario.allocations.customPriority ?? accounts.map((a) => a.id)
  );

  function handleStrategyChange(newStrategy: ScenarioStrategy) {
    const newPriority =
      newStrategy === "custom"
        ? scenario.allocations.customPriority ?? accounts.map((a) => a.id)
        : scenario.allocations.customPriority;

    if (newStrategy === "custom") {
      setCustomPriority(newPriority ?? accounts.map((a) => a.id));
    }

    dispatch({
      type: "UPDATE_SCENARIO",
      index: scenarioIndex,
      state: {
        strategy: newStrategy,
        allocations: {
          ...scenario.allocations,
          customPriority:
            newStrategy === "custom"
              ? (newPriority ?? accounts.map((a) => a.id))
              : scenario.allocations.customPriority,
        },
      },
    });
  }

  function moveAccount(index: number, direction: "up" | "down") {
    const newPriority = [...customPriority];
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= newPriority.length) return;
    [newPriority[index], newPriority[swapWith]] = [newPriority[swapWith], newPriority[index]];
    setCustomPriority(newPriority);
    dispatch({
      type: "UPDATE_SCENARIO",
      index: scenarioIndex,
      state: {
        allocations: {
          ...scenario.allocations,
          customPriority: newPriority,
        },
      },
    });
  }

  function handleCascadeChange(fromAccountId: string, toAccountId: string | "auto") {
    const existing = scenario.allocations.cascadeRedirects.filter(
      (r) => r.fromAccountId !== fromAccountId
    );
    const newRedirects =
      toAccountId === "auto"
        ? existing
        : [...existing, { fromAccountId, toAccountId }];

    dispatch({
      type: "UPDATE_SCENARIO",
      index: scenarioIndex,
      state: {
        allocations: {
          ...scenario.allocations,
          cascadeRedirects: newRedirects,
        },
      },
    });
  }

  function getCascadeValue(fromAccountId: string): string {
    const redirect = scenario.allocations.cascadeRedirects.find(
      (r) => r.fromAccountId === fromAccountId
    );
    return redirect?.toAccountId ?? "auto";
  }

  // Build ordered accounts for custom priority display
  const orderedAccounts =
    scenario.strategy === "custom"
      ? customPriority
          .map((id) => accounts.find((a) => a.id === id))
          .filter((a): a is DebtAccount => a !== undefined)
      : accounts;

  return (
    <div className="space-y-4">
      {/* Strategy selector */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Estrategia de pago</CardTitle>
          <CardDescription>
            Elige cómo se distribuye el dinero extra entre tus deudas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <StrategyCard
            value="avalanche"
            selected={scenario.strategy === "avalanche"}
            icon={<Mountain className="h-4 w-4" />}
            title="Avalancha"
            description="Paga primero la tasa más alta — minimiza intereses totales"
            onClick={() => handleStrategyChange("avalanche")}
          />
          <StrategyCard
            value="snowball"
            selected={scenario.strategy === "snowball"}
            icon={<Snowflake className="h-4 w-4" />}
            title="Bola de Nieve"
            description="Paga primero el saldo más bajo — victorias rápidas para motivación"
            onClick={() => handleStrategyChange("snowball")}
          />

          {/* Show account priority based on selected strategy */}
          {scenario.strategy !== "custom" && (
            <div className="mt-3 rounded-md bg-z-surface-2 px-3 py-2.5">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Orden de ataque ({scenario.strategy === "avalanche" ? "tasa más alta primero" : "saldo más bajo primero"}):
              </p>
              <div className="space-y-1">
                {[...accounts]
                  .filter((a) => a.balance > 0)
                  .sort((a, b) =>
                    scenario.strategy === "avalanche"
                      ? ((b.interestRate ?? 0) - (a.interestRate ?? 0)) || (a.balance - b.balance)
                      : (a.balance - b.balance) || ((b.interestRate ?? 0) - (a.interestRate ?? 0))
                  )
                  .map((a, i) => (
                    <div key={a.id} className="flex items-center gap-2 text-xs">
                      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground shrink-0">
                        {i + 1}
                      </span>
                      <span className="font-medium truncate">{a.name}</span>
                      <span className="text-muted-foreground ml-auto shrink-0">
                        {a.interestRate != null ? `${a.interestRate}% EA` : "sin tasa"}
                        {" · "}
                        {formatCurrency(a.balance, a.currency as CurrencyCode)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
          <StrategyCard
            value="custom"
            selected={scenario.strategy === "custom"}
            icon={<ListOrdered className="h-4 w-4" />}
            title="Personalizado"
            description="Define tu propio orden de prioridad"
            onClick={() => handleStrategyChange("custom")}
          />
        </CardContent>
      </Card>

      {/* Custom priority order */}
      {scenario.strategy === "custom" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Orden de prioridad</CardTitle>
            <CardDescription>
              El primero de la lista recibe el extra; los demás solo pagan mínimos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {orderedAccounts.map((account, idx) => (
              <div
                key={account.id}
                className="flex items-center gap-3 rounded-md border bg-muted/30 px-3 py-2"
              >
                <span className="text-sm font-medium text-muted-foreground w-5 text-center">
                  {idx + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{account.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {account.interestRate !== null
                      ? `${account.interestRate.toFixed(1)}% · `
                      : ""}
                    {formatCurrency(account.balance, currency)}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={idx === 0}
                    onClick={() => moveAccount(idx, "up")}
                    aria-label="Mover arriba"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    disabled={idx === orderedAccounts.length - 1}
                    onClick={() => moveAccount(idx, "down")}
                    aria-label="Mover abajo"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Cascade redirects */}
      {accounts.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
              Cascada de pagos
            </CardTitle>
            <CardDescription>
              Cuando una deuda se liquide, ¿a cuál redirigir ese pago liberado?
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {accounts.map((account) => {
              const currentValue = getCascadeValue(account.id);
              return (
                <div key={account.id} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{account.name}</p>
                    {account.interestRate !== null && (
                      <p className="text-xs text-muted-foreground">
                        {account.interestRate.toFixed(1)}% · {formatCurrency(account.balance, currency)}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <Select
                    value={currentValue}
                    onValueChange={(val) => handleCascadeChange(account.id, val)}
                  >
                    <SelectTrigger className="w-44 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">Automático</SelectItem>
                      {accounts
                        .filter((a) => a.id !== account.id)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Projection preview */}
      {result !== undefined && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-muted-foreground" />
              Proyección
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-0.5">
                <p className="text-2xl font-bold">{result.totalMonths}</p>
                <p className="text-xs text-muted-foreground">meses</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-xl font-bold truncate">
                  {formatCurrency(result.totalInterestPaid, currency)}
                </p>
                <p className="text-xs text-muted-foreground">en intereses</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-semibold leading-tight">
                  {formatDebtFreeDate(result.debtFreeDate)}
                </p>
                <p className="text-xs text-muted-foreground">libre de deuda</p>
              </div>
            </div>
            {result.payoffOrder.length > 0 && (
              <div className="mt-4 pt-3 border-t space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Orden de liquidación
                </p>
                {result.payoffOrder.map((entry, idx) => {
                  const [year, mon] = entry.calendarMonth.split("-");
                  const date = new Date(Number(year), Number(mon) - 1, 1);
                  const dateLabel = date.toLocaleDateString("es-CO", {
                    month: "short",
                    year: "numeric",
                  });
                  return (
                    <div key={entry.accountId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground text-xs w-4">{idx + 1}.</span>
                        <span className="font-medium truncate max-w-36">{entry.accountName}</span>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {dateLabel}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
