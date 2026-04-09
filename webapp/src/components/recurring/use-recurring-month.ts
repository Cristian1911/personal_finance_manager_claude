"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  addMonths,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import {
  recordRecurringOccurrencePayment,
} from "@/actions/recurring-templates";
import {
  getOccurrencesForMonth,
  skipOccurrence,
  ensureOccurrencesForRange,
} from "@/actions/occurrences";
import { toast } from "sonner";
import type {
  Account,
  RecurringTemplateWithRelations,
} from "@/types/domain";
import type { RecurringOccurrence } from "@/actions/occurrences";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface OccurrenceItem {
  key: string; // templateId:date
  occurrenceId: string; // DB row ID for skip/paid mutations
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
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function mapToOccurrenceItem(
  o: RecurringOccurrence,
  accounts: Account[]
): OccurrenceItem {
  const isDebtPayment =
    o.account_type === "CREDIT_CARD" || o.account_type === "LOAN";
  return {
    key: `${o.template_id}:${o.occurrence_date}`,
    occurrenceId: o.id,
    templateId: o.template_id,
    merchant: o.merchant_name ?? o.description ?? "Recurrente",
    date: o.occurrence_date,
    plannedAmount: o.expected_amount,
    direction: o.direction,
    accountName: o.account_name,
    accountId: o.account_id,
    categoryName: o.category_name ?? "Sin categoría",
    categoryIcon: o.category_icon ?? "tag",
    categoryColor: o.category_color ?? "#6b7280",
    currencyCode: o.currency_code,
    isDebtPayment,
    transferSourceAccountId: o.transfer_source_account_id,
    accountLastFour: accounts.find((a) => a.id === o.account_id)?.mask ?? "",
  };
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useRecurringMonth(
  _templates: RecurringTemplateWithRelations[], // kept for caller signature compat
  accounts: Account[]
) {
  const router = useRouter();

  /* ---- month cursor ---- */
  const [monthCursor, setMonthCursor] = useState(() => new Date());
  const monthStart = startOfMonth(monthCursor);
  const monthEnd = endOfMonth(monthCursor);
  const monthKey = format(monthCursor, "yyyy-MM");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const monthLabel = format(monthCursor, "MMMM yyyy", { locale: es });

  const goNextMonth = useCallback(
    () => setMonthCursor((prev) => addMonths(prev, 1)),
    []
  );
  const goPrevMonth = useCallback(
    () => setMonthCursor((prev) => subMonths(prev, 1)),
    []
  );

  /* ---- DB-backed occurrences state ---- */
  const [occurrences, setOccurrences] = useState<RecurringOccurrence[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  /* ---- Load occurrences from DB on mount and month change ---- */
  useEffect(() => {
    setIsHydrated(false);
    let cancelled = false;

    const load = async () => {
      const [, result] = await Promise.all([
        ensureOccurrencesForRange(monthStart, monthEnd),
        getOccurrencesForMonth(monthKey),
      ]);
      if (cancelled) return;
      if (result.success) {
        setOccurrences(result.data);
      }
      setIsHydrated(true);
    };

    load();
    return () => {
      cancelled = true;
    };
    // monthStart/monthEnd are derived from monthKey — only re-run when monthKey changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey]);

  /* ---- pending / completed splits ---- */
  const pending = useMemo(
    () =>
      occurrences
        .filter((o) => o.status === "pending")
        .map((o) => mapToOccurrenceItem(o, accounts)),
    [occurrences, accounts]
  );

  const completed = useMemo(
    () =>
      occurrences
        .filter((o) => o.status !== "pending")
        .map((o) => mapToOccurrenceItem(o, accounts)),
    [occurrences, accounts]
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
    for (const o of occurrences) {
      const entry = map.get(o.occurrence_date) ?? { total: 0, completed: 0 };
      entry.total += 1;
      if (o.status !== "pending") entry.completed += 1;
      map.set(o.occurrence_date, entry);
    }
    return map;
  }, [occurrences]);

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
        toast.error("Ingresa un monto pagado valido antes de confirmar el pago.");
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

      // Optimistically mark as paid in local state
      setOccurrences((prev) =>
        prev.map((o) =>
          o.id === item.occurrenceId ? { ...o, status: "paid" as const } : o
        )
      );

      const created = result.data?.created ?? 0;
      const duplicates = result.data?.alreadyRecorded ?? 0;

      if (created > 0) {
        const msg = item.isDebtPayment
          ? "Pago registrado como transferencia + abono a deuda"
          : "Pago recurrente registrado";

        toast.success(msg);
        router.refresh();
      } else if (duplicates > 0) {
        toast.info("Este pago ya estaba registrado anteriormente.");
      }
    },
    [todayStr, router]
  );

  /* ---- skip payment ---- */
  const skipPayment = useCallback(
    async (item: OccurrenceItem) => {
      // Optimistic update
      setOccurrences((prev) =>
        prev.map((o) =>
          o.id === item.occurrenceId ? { ...o, status: "skipped" as const } : o
        )
      );
      toast.success("Marcado como completado");

      const result = await skipOccurrence(item.occurrenceId);
      if (!result.success) {
        // Revert on failure
        setOccurrences((prev) =>
          prev.map((o) =>
            o.id === item.occurrenceId
              ? { ...o, status: "pending" as const }
              : o
          )
        );
        toast.error("No se pudo guardar. Intenta de nuevo.");
      } else {
        router.refresh();
      }
    },
    [router]
  );

  /* ---- totals ---- */
  const totalPlanned = useMemo(
    () =>
      occurrences
        .filter(
          (o) =>
            o.direction === "OUTFLOW" ||
            o.account_type === "CREDIT_CARD" ||
            o.account_type === "LOAN"
        )
        .reduce((sum, o) => sum + o.expected_amount, 0),
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

    // Loading state
    isHydrated,

    // Actions
    confirmPayment,
    skipPayment,
    busyItems,

    // Helpers
    getDateStatus,
    totalPlanned,
  };
}
