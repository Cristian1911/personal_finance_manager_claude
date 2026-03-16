"use client";

import { useState } from "react";
import type { DebtAccount, CashEntry } from "@zeta/shared";
import type { CurrencyCode } from "@zeta/shared";
import type { PlannerAction } from "../scenario-planner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils/currency";
import { Plus, Trash2, CalendarPlus, DollarSign, Repeat } from "lucide-react";

interface Props {
  accounts: DebtAccount[];
  cashEntries: CashEntry[];
  currency?: CurrencyCode;
  dispatch: React.Dispatch<PlannerAction>;
}

function getNextMonthDate(): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const yyyy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}-01`;
}

function formatEntryDate(dateStr: string): string {
  // dateStr can be "YYYY-MM-DD" or "YYYY-MM"
  if (dateStr.length === 10) {
    const [year, mon, day] = dateStr.split("-");
    const date = new Date(Number(year), Number(mon) - 1, Number(day));
    return date.toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
  }
  const [year, mon] = dateStr.split("-");
  const date = new Date(Number(year), Number(mon) - 1, 1);
  return date.toLocaleDateString("es-CO", { month: "short", year: "numeric" });
}

interface AddFormState {
  amount: string;
  date: string; // "YYYY-MM-DD" full date for planning context
  label: string;
  recurring: boolean;
  recurringMonths: string;
}

const defaultFormState = (): AddFormState => ({
  amount: "",
  date: getNextMonthDate(),
  label: "",
  recurring: false,
  recurringMonths: "3",
});

export function CashStep({ accounts, cashEntries, currency = "COP", dispatch }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<AddFormState>(defaultFormState);

  const totalDebt = accounts.reduce((sum, a) => sum + a.balance, 0);
  const totalCash = cashEntries.reduce((sum, e) => sum + e.amount, 0);

  function handleAddEntry() {
    const amount = parseFloat(form.amount);
    if (!form.amount || isNaN(amount) || amount <= 0) return;
    if (!form.date) return;

    // Engine works at month granularity — extract YYYY-MM
    const month = form.date.slice(0, 7);
    // Include the full date in the label for user planning context
    const dateContext = form.label.trim()
      ? `${form.label.trim()} (${formatEntryDate(form.date)})`
      : formatEntryDate(form.date);

    const entry: CashEntry = {
      id: crypto.randomUUID(),
      amount,
      month,
      currency,
      label: dateContext,
      ...(form.recurring && parseInt(form.recurringMonths) > 1
        ? { recurring: { months: parseInt(form.recurringMonths) } }
        : {}),
    };

    dispatch({ type: "ADD_CASH_ENTRY", entry });
    setForm(defaultFormState());
    setShowForm(false);
  }

  function handleCancel() {
    setForm(defaultFormState());
    setShowForm(false);
  }

  return (
    <div className="space-y-4">
      {/* Debt summary */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Deuda total:</span>
              <span className="font-semibold">{formatCurrency(totalDebt, currency)}</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{accounts.length} {accounts.length === 1 ? "deuda" : "deudas"}</Badge>
            </div>
            {cashEntries.length > 0 && (
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-muted-foreground">Efectivo planeado:</span>
                <span className="font-semibold text-green-600">{formatCurrency(totalCash, currency)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Add button / inline form */}
      {!showForm ? (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowForm(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Agregar efectivo
        </Button>
      ) : (
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarPlus className="h-4 w-4" />
              Nuevo efectivo extra
            </CardTitle>
            <CardDescription>
              Dinero adicional que planeas usar para pagar deudas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {/* Amount */}
              <div className="space-y-1.5">
                <Label htmlFor="cash-amount">Monto</Label>
                <CurrencyInput
                  id="cash-amount"
                  placeholder="500.000"
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                />
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <Label htmlFor="cash-date">Fecha de pago</Label>
                <Input
                  id="cash-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
            </div>

            {/* Label */}
            <div className="space-y-1.5">
              <Label htmlFor="cash-label">Etiqueta <span className="text-muted-foreground">(opcional)</span></Label>
              <Input
                id="cash-label"
                placeholder="ej. Prima de junio, bono de fin de año…"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>

            {/* Recurring toggle */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Switch
                  id="cash-recurring"
                  checked={form.recurring}
                  onCheckedChange={(checked) =>
                    setForm((f) => ({ ...f, recurring: checked }))
                  }
                />
                <Label htmlFor="cash-recurring" className="flex items-center gap-1.5 cursor-pointer">
                  <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                  Repetir mensualmente
                </Label>
              </div>

              {form.recurring && (
                <div className="flex items-center gap-3 pl-10">
                  <Label htmlFor="cash-months" className="whitespace-nowrap text-sm">
                    Número de meses:
                  </Label>
                  <Input
                    id="cash-months"
                    type="number"
                    min={2}
                    max={60}
                    className="w-20"
                    value={form.recurringMonths}
                    onChange={(e) => setForm((f) => ({ ...f, recurringMonths: e.target.value }))}
                  />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button onClick={handleAddEntry} className="flex-1">
                <Plus className="h-4 w-4 mr-1.5" />
                Agregar
              </Button>
              <Button variant="outline" onClick={handleCancel}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entry list */}
      {cashEntries.length > 0 ? (
        <div className="space-y-2">
          {cashEntries.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="pt-3 pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                      <span className="text-base font-semibold">
                        {formatCurrency(entry.amount, entry.currency)}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {entry.label || formatEntryDate(entry.month)}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      {entry.label ? (
                        <span className="text-sm text-muted-foreground truncate">
                          {entry.label}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground/60 italic">
                          sin etiqueta
                        </span>
                      )}
                      {entry.recurring ? (
                        <Badge variant="secondary" className="text-xs flex items-center gap-1">
                          <Repeat className="h-3 w-3" />
                          {entry.recurring.months} meses
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs text-muted-foreground">
                          Una vez
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => dispatch({ type: "REMOVE_CASH_ENTRY", id: entry.id })}
                    aria-label="Eliminar entrada"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        !showForm && (
          <div className="text-center py-10 text-muted-foreground">
            <CalendarPlus className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">
              Agrega el efectivo extra que planeas usar para pagar deudas
            </p>
            <p className="text-xs mt-1 opacity-70">
              Por ejemplo: bonos, primas, ahorros disponibles
            </p>
          </div>
        )
      )}
    </div>
  );
}
