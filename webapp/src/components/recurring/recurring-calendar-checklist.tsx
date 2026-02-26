"use client";

import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  endOfMonth,
  eachDayOfInterval,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getOccurrencesBetween } from "@venti5/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils/currency";
import { recordRecurringOccurrencePayment } from "@/actions/recurring-templates";
import { toast } from "sonner";
import type {
  Account,
  CurrencyCode,
  RecurringTemplateWithRelations,
} from "@/types/domain";

type OccurrenceItem = {
  key: string;
  templateId: string;
  merchant: string;
  date: string;
  plannedAmount: number;
  direction: "INFLOW" | "OUTFLOW";
  accountName: string;
  accountId: string;
  categoryName: string;
  currencyCode: CurrencyCode;
  isDebtPayment: boolean;
  transferSourceAccountId: string | null;
};

const DEBT_ACCOUNT_TYPES = new Set(["CREDIT_CARD", "LOAN"]);

export function RecurringCalendarChecklist({
  templates,
  accounts,
}: {
  templates: RecurringTemplateWithRelations[];
  accounts: Account[];
}) {
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const monthStart = startOfMonth(monthCursor);
  const monthEnd = endOfMonth(monthCursor);
  const monthKey = format(monthCursor, "yyyy-MM");
  const todayDate = format(new Date(), "yyyy-MM-dd");
  const storageKey = `venti5:recurring-checklist:${monthKey}`;
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});
  const [amountOverrides, setAmountOverrides] = useState<Record<string, string>>({});
  const [paidDateOverrides, setPaidDateOverrides] = useState<Record<string, string>>({});
  const [sourceOverrides, setSourceOverrides] = useState<Record<string, string>>({});
  const [busyItems, setBusyItems] = useState<Record<string, boolean>>({});

  const occurrences = useMemo<OccurrenceItem[]>(() => {
    const list: OccurrenceItem[] = [];

    for (const template of templates) {
      if (!template.is_active) continue;

      const dates = getOccurrencesBetween(
        template.start_date,
        template.frequency,
        template.end_date,
        monthStart,
        monthEnd
      );

      for (const date of dates) {
        const isDebtPayment = DEBT_ACCOUNT_TYPES.has(template.account.account_type);
        list.push({
          key: `${template.id}:${date}`,
          templateId: template.id,
          merchant: template.merchant_name ?? "Recurrente",
          date,
          plannedAmount: template.amount,
          direction: template.direction,
          accountName: template.account.name,
          accountId: template.account.id,
          categoryName:
            template.category?.name_es ?? template.category?.name ?? "Sin categoria",
          currencyCode: template.currency_code as CurrencyCode,
          isDebtPayment,
          transferSourceAccountId: template.transfer_source_account?.id ?? null,
        });
      }
    }

    return list.sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return a.merchant.localeCompare(b.merchant);
    });
  }, [templates, monthStart, monthEnd]);

  const outflowChecklist = useMemo(
    () => occurrences.filter((item) => item.direction === "OUTFLOW" || item.isDebtPayment),
    [occurrences]
  );
  const pendingChecklist = useMemo(
    () => outflowChecklist.filter((item) => !checkedItems[item.key]),
    [outflowChecklist, checkedItems]
  );
  const completedChecklist = useMemo(
    () => outflowChecklist.filter((item) => checkedItems[item.key]),
    [outflowChecklist, checkedItems]
  );

  const occurrenceCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of occurrences) {
      map.set(item.date, (map.get(item.date) ?? 0) + 1);
    }
    return map;
  }, [occurrences]);

  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const leadingEmptyCells = monthStart.getDay();

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setCheckedItems({});
        return;
      }
      const parsed = JSON.parse(raw) as Record<string, boolean>;
      setCheckedItems(parsed ?? {});
    } catch {
      setCheckedItems({});
    }
  }, [storageKey]);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(checkedItems));
  }, [storageKey, checkedItems]);

  useEffect(() => {
    setAmountOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const item of outflowChecklist) {
        if (!next[item.key]) {
          next[item.key] = String(item.plannedAmount);
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    setPaidDateOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const item of outflowChecklist) {
        if (!next[item.key]) {
          next[item.key] = todayDate;
          changed = true;
        }
      }
      return changed ? next : prev;
    });

    setSourceOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const item of outflowChecklist) {
        if (item.isDebtPayment && !next[item.key] && item.transferSourceAccountId) {
          next[item.key] = item.transferSourceAccountId;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [outflowChecklist, todayDate]);

  async function handleMarkAsPaid(item: OccurrenceItem) {
    const amountValue = Number(amountOverrides[item.key] ?? item.plannedAmount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      toast.error("Ingresa un monto real válido antes de confirmar el pago.");
      return;
    }
    const paymentDate = paidDateOverrides[item.key] ?? todayDate;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
      toast.error("Selecciona una fecha de pago válida.");
      return;
    }

    const sourceAccountId = item.isDebtPayment
      ? sourceOverrides[item.key] || item.transferSourceAccountId || null
      : null;

    if (item.isDebtPayment && !sourceAccountId) {
      toast.error("Selecciona la cuenta origen para registrar la transferencia a la deuda.");
      return;
    }

    setBusyItems((prev) => ({ ...prev, [item.key]: true }));

    const result = await recordRecurringOccurrencePayment({
      templateId: item.templateId,
      occurrenceDate: item.date,
      paymentDate,
      actualAmount: amountValue,
      sourceAccountId,
    });

    setBusyItems((prev) => ({ ...prev, [item.key]: false }));

    if (!result.success) {
      toast.error(result.error ?? "No se pudo registrar el pago recurrente.");
      return;
    }

    setCheckedItems((prev) => ({ ...prev, [item.key]: true }));

    const created = result.data?.created ?? 0;
    const duplicates = result.data?.alreadyRecorded ?? 0;

    if (created > 0) {
      toast.success(
        item.isDebtPayment
          ? "Pago registrado como transferencia + abono a deuda"
          : "Pago recurrente registrado"
      );
    } else if (duplicates > 0) {
      toast.info("Este pago ya estaba registrado anteriormente.");
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-lg">Calendario de pagos recurrentes</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setMonthCursor((prev) => subMonths(prev, 1))}
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-36 text-center text-sm font-medium capitalize">
              {format(monthCursor, "MMMM yyyy", { locale: es })}
            </div>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setMonthCursor((prev) => addMonths(prev, 1))}
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        <div className="grid grid-cols-7 gap-2 text-center text-xs text-muted-foreground">
          {["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"].map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: leadingEmptyCells }).map((_, idx) => (
            <div
              key={`empty-${idx}`}
              className="h-20 rounded-md border border-dashed border-muted/40"
            />
          ))}

          {monthDays.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const count = occurrenceCountByDate.get(dateKey) ?? 0;
            const isToday = format(new Date(), "yyyy-MM-dd") === dateKey;

            return (
              <div
                key={dateKey}
                className={`h-20 rounded-md border p-2 ${
                  isToday ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <div className="text-xs font-medium">{format(day, "d")}</div>
                {count > 0 && (
                  <div className="mt-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                    {count} pago{count > 1 ? "s" : ""}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Mapeo de pagos recurrentes</h3>
            <span className="text-xs text-muted-foreground">
              {pendingChecklist.length} pendientes · {completedChecklist.length} completados
            </span>
          </div>

          {outflowChecklist.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay pagos recurrentes en este mes.
            </p>
          ) : (
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Pendientes por mapear</h4>
                  <Badge variant="secondary">{pendingChecklist.length}</Badge>
                </div>
                {pendingChecklist.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No hay pagos pendientes en este mes.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {pendingChecklist.map((item) => {
                      const currentAmount = Number(
                        amountOverrides[item.key] ?? item.plannedAmount
                      );
                      const delta = Number.isFinite(currentAmount)
                        ? currentAmount - item.plannedAmount
                        : 0;
                      const hasLargeDelta =
                        item.plannedAmount > 0 &&
                        Math.abs(delta) / item.plannedAmount >= 0.15;
                      const sourceAccountCandidates = accounts.filter(
                        (acc) => acc.id !== item.accountId
                      );

                      return (
                        <div key={item.key} className="rounded-md border p-3 space-y-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">{item.merchant}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {format(new Date(`${item.date}T00:00:00`), "dd MMM", {
                                  locale: es,
                                })}
                                {" · "}
                                {item.accountName}
                                {" · "}
                                {item.isDebtPayment ? "Abono de deuda" : item.categoryName}
                              </p>
                            </div>
                            <p className="text-sm font-semibold">
                              Plan: {formatCurrency(item.plannedAmount, item.currencyCode)}
                            </p>
                          </div>

                          <div className="grid gap-3 md:grid-cols-2">
                            <div>
                              <label className="mb-1 block text-xs text-muted-foreground">
                                Monto real pagado
                              </label>
                              <Input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={amountOverrides[item.key] ?? String(item.plannedAmount)}
                                onChange={(e) =>
                                  setAmountOverrides((prev) => ({
                                    ...prev,
                                    [item.key]: e.target.value,
                                  }))
                                }
                              />
                              {hasLargeDelta && (
                                <p className="mt-1 text-xs text-amber-600">
                                  Diferencia notable vs plan ({delta > 0 ? "+" : ""}
                                  {formatCurrency(delta, item.currencyCode)}).
                                </p>
                              )}
                              <label className="mb-1 mt-3 block text-xs text-muted-foreground">
                                Fecha real de pago
                              </label>
                              <div className="flex gap-2">
                                <Input
                                  type="date"
                                  value={paidDateOverrides[item.key] ?? todayDate}
                                  onChange={(e) =>
                                    setPaidDateOverrides((prev) => ({
                                      ...prev,
                                      [item.key]: e.target.value,
                                    }))
                                  }
                                />
                                <Button
                                  type="button"
                                  variant="outline"
                                  onClick={() =>
                                    setPaidDateOverrides((prev) => ({
                                      ...prev,
                                      [item.key]: todayDate,
                                    }))
                                  }
                                >
                                  Hoy
                                </Button>
                              </div>
                            </div>

                            {item.isDebtPayment && (
                              <div>
                                <label className="mb-1 block text-xs text-muted-foreground">
                                  Cuenta origen de la transferencia
                                </label>
                                <select
                                  className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                                  value={
                                    sourceOverrides[item.key] ||
                                    item.transferSourceAccountId ||
                                    ""
                                  }
                                  onChange={(e) =>
                                    setSourceOverrides((prev) => ({
                                      ...prev,
                                      [item.key]: e.target.value,
                                    }))
                                  }
                                >
                                  <option value="">Seleccionar cuenta origen</option>
                                  {sourceAccountCandidates.map((acc) => (
                                    <option key={acc.id} value={acc.id}>
                                      {acc.name}
                                    </option>
                                  ))}
                                </select>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Se crearán 2 movimientos: salida en cuenta origen y abono en la deuda.
                                </p>
                              </div>
                            )}
                          </div>

                          <Button
                            type="button"
                            className="w-full"
                            disabled={!!busyItems[item.key]}
                            onClick={() => handleMarkAsPaid(item)}
                          >
                            {busyItems[item.key] ? "Mapeando..." : "Ya realice el pago, mapear"}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium">Completados del mes</h4>
                  <Badge variant="outline">{completedChecklist.length}</Badge>
                </div>
                {completedChecklist.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aún no hay pagos mapeados en este mes.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {completedChecklist.map((item) => {
                      const recordedAmount = Number(
                        amountOverrides[item.key] ?? item.plannedAmount
                      );
                      return (
                        <div
                          key={item.key}
                          className="rounded-md border border-emerald-200 bg-emerald-50 p-3"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">{item.merchant}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {format(new Date(`${item.date}T00:00:00`), "dd MMM", {
                                  locale: es,
                                })}
                                {" · "}
                                {item.accountName}
                              </p>
                            </div>
                            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                              Mapeado
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm font-medium text-emerald-900">
                            {formatCurrency(recordedAmount, item.currencyCode)}
                          </p>
                          <p className="mt-1 text-xs text-emerald-900/80">
                            Fecha de pago:{" "}
                            {format(
                              new Date(
                                `${(paidDateOverrides[item.key] ?? todayDate)}T00:00:00`
                              ),
                              "dd MMM yyyy",
                              { locale: es }
                            )}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
