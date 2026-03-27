"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { getOccurrencesBetween } from "@zeta/shared";
import { recordRecurringOccurrencePayment } from "@/actions/recurring-templates";
import { toast } from "sonner";
import type {
  Account,
  RecurringTemplateWithRelations,
} from "@/types/domain";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface OccurrenceItem {
  key: string; // templateId:date
  templateId: string;
  merchant: string;
  date: string; // YYYY-MM-DD
  plannedAmount: number;
  direction: "INFLOW" | "OUTFLOW";
  accountName: string;
  accountId: string;
  categoryName: string;
  categoryIcon: string;
  categoryColor: string;
  currencyCode: string;
  isDebtPayment: boolean;
  transferSourceAccountId: string | null;
  accountLastFour: string;
}

export type DateStatus = "today" | "past" | "future";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DEBT_ACCOUNT_TYPES = new Set(["CREDIT_CARD", "LOAN"]);

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useRecurringMonth(
  templates: RecurringTemplateWithRelations[],
  accounts: Account[]
) {
  /* ---- month cursor ---- */
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const monthStart = startOfMonth(monthCursor);
  const monthEnd = endOfMonth(monthCursor);
  const monthKey = format(monthCursor, "yyyy-MM");
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const storageKey = `zeta:recurring-checklist:${monthKey}`;

  const monthLabel = format(monthCursor, "MMMM yyyy", { locale: es });

  const goNextMonth = useCallback(
    () => setMonthCursor((prev) => addMonths(prev, 1)),
    []
  );
  const goPrevMonth = useCallback(
    () => setMonthCursor((prev) => subMonths(prev, 1)),
    []
  );

  /* ---- checked items (localStorage) ---- */
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // Load from localStorage on mount and when month changes
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      setCheckedItems(raw ? (JSON.parse(raw) as Record<string, boolean>) : {});
    } catch {
      setCheckedItems({});
    }
  }, [storageKey]);

  // Write helper — syncs to localStorage inside the state update
  const updateCheckedItems = useCallback(
    (updater: (prev: Record<string, boolean>) => Record<string, boolean>) => {
      setCheckedItems((prev) => {
        const next = updater(prev);
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(next));
        } catch { /* quota exceeded — silent */ }
        return next;
      });
    },
    [storageKey]
  );

  /* ---- occurrence generation ---- */
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

      const isDebtPayment = DEBT_ACCOUNT_TYPES.has(
        template.account.account_type
      );

      for (const date of dates) {
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
            template.category?.name_es ??
            template.category?.name ??
            "Sin categoría",
          categoryIcon: template.category?.icon ?? "tag",
          categoryColor: template.category?.color ?? "#6b7280",
          currencyCode: (template.currency_code ?? template.account.currency_code) as string,
          isDebtPayment,
          transferSourceAccountId:
            template.transfer_source_account?.id ?? null,
          accountLastFour:
            accounts.find((a) => a.id === template.account.id)?.mask ?? "",
        });
      }
    }

    return list.sort((a, b) => {
      const byDate = a.date.localeCompare(b.date);
      if (byDate !== 0) return byDate;
      return a.merchant.localeCompare(b.merchant);
    });
  }, [templates, accounts, monthStart, monthEnd]);

  /* ---- pending / completed splits ---- */
  const pending = useMemo(
    () => occurrences.filter((item) => !checkedItems[item.key]),
    [occurrences, checkedItems]
  );

  const completed = useMemo(
    () => occurrences.filter((item) => checkedItems[item.key]),
    [occurrences, checkedItems]
  );

  /* ---- pending grouped by date ---- */
  const pendingByDate = useMemo(() => {
    const map = new Map<string, OccurrenceItem[]>();
    for (const item of pending) {
      const group = map.get(item.date) ?? [];
      group.push(item);
      map.set(item.date, group);
    }
    return map;
  }, [pending]);

  /* ---- occurrence counts per date (for calendar dots) ---- */
  const dateOccurrenceCounts = useMemo(() => {
    const map = new Map<string, { total: number; completed: number }>();
    for (const item of occurrences) {
      const entry = map.get(item.date) ?? { total: 0, completed: 0 };
      entry.total += 1;
      if (checkedItems[item.key]) entry.completed += 1;
      map.set(item.date, entry);
    }
    return map;
  }, [occurrences, checkedItems]);

  /* ---- date status helper ---- */
  const getDateStatus = useCallback(
    (dateStr: string): DateStatus => {
      if (dateStr === todayStr) return "today";
      return dateStr < todayStr ? "past" : "future";
    },
    [todayStr]
  );

  /* ---- busy state for in-flight confirmations ---- */
  const [busyItems, setBusyItems] = useState<Record<string, boolean>>({});

  /* ---- confirm payment ---- */
  const confirmPayment = useCallback(
    async (
      item: OccurrenceItem,
      overrides?: {
        actualAmount?: number;
        paymentDate?: string;
        sourceAccountId?: string | null;
      }
    ) => {
      const actualAmount = overrides?.actualAmount ?? item.plannedAmount;
      if (!Number.isFinite(actualAmount) || actualAmount <= 0) {
        toast.error("Ingresa un monto real válido antes de confirmar el pago.");
        return;
      }

      const paymentDate = overrides?.paymentDate ?? todayStr;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
        toast.error("Selecciona una fecha de pago válida.");
        return;
      }

      const sourceAccountId = item.isDebtPayment
        ? (overrides?.sourceAccountId ??
            item.transferSourceAccountId ??
            null)
        : null;

      if (item.isDebtPayment && !sourceAccountId) {
        toast.error(
          "Selecciona la cuenta origen para registrar la transferencia a la deuda."
        );
        return;
      }

      setBusyItems((prev) => ({ ...prev, [item.key]: true }));

      const result = await recordRecurringOccurrencePayment({
        templateId: item.templateId,
        occurrenceDate: item.date,
        paymentDate,
        actualAmount,
        sourceAccountId,
      });

      setBusyItems((prev) => ({ ...prev, [item.key]: false }));

      if (!result.success) {
        toast.error(result.error ?? "No se pudo registrar el pago recurrente.");
        return;
      }

      // Mark as checked and persist to localStorage
      updateCheckedItems((prev) => ({ ...prev, [item.key]: true }));

      const created = result.data?.created ?? 0;
      const duplicates = result.data?.alreadyRecorded ?? 0;

      if (created > 0) {
        const msg = item.isDebtPayment
          ? "Pago registrado como transferencia + abono a deuda"
          : "Pago recurrente registrado";

        toast.success(msg);
      } else if (duplicates > 0) {
        toast.info("Este pago ya estaba registrado anteriormente.");
      }
    },
    [todayStr, updateCheckedItems]
  );

  /* ---- skip payment (already paid manually) ---- */
  const skipPayment = useCallback(
    (item: OccurrenceItem) => {
      updateCheckedItems((prev) => ({ ...prev, [item.key]: true }));
      toast.success("Marcado como completado");
    },
    [updateCheckedItems]
  );

  /* ---- totals ---- */
  const totalPlanned = useMemo(
    () =>
      occurrences
        .filter((o) => o.direction === "OUTFLOW" || o.isDebtPayment)
        .reduce((sum, o) => sum + o.plannedAmount, 0),
    [occurrences]
  );

  return {
    // Month navigation
    monthCursor,
    monthKey,
    monthLabel,
    monthStart,
    monthEnd,
    goNextMonth,
    goPrevMonth,

    // Occurrences
    occurrences,
    pending,
    completed,
    pendingByDate,
    dateOccurrenceCounts,

    // Checked state
    checkedItems,

    // Actions
    confirmPayment,
    skipPayment,
    busyItems,

    // Helpers
    getDateStatus,
    totalPlanned,
  };
}
