"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  addMonths,
  endOfMonth,
  format,
  startOfMonth,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import { formatMonthParam, isCurrentMonth, parseMonth } from "@/lib/utils/date";
import {
  recordRecurringOccurrencePayment,
} from "@/actions/recurring-templates";
import {
  getOccurrencesForMonth,
  skipOccurrence,
  revertOccurrence,
  ensureOccurrencesForRange,
  linkExistingTransactionToOccurrence,
} from "@/actions/occurrences";
import { toast } from "sonner";
import type {
  Account,
  RecurringTemplateWithRelations,
} from "@/types/domain";
import type { RecurringOccurrence, OccurrenceSubPayment } from "@/actions/occurrences";

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
  status: "pending" | "paid" | "skipped";
  transactionId: string | null;
  subPayments: OccurrenceSubPayment[] | null;
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
    status: o.status as "pending" | "paid" | "skipped",
    transactionId: o.transaction_id,
    subPayments: o.sub_payments,
  };
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useRecurringMonth(
  _templates: RecurringTemplateWithRelations[], // kept for caller signature compat
  accounts: Account[],
  initialOccurrences?: RecurringOccurrence[]
) {
  const [, startTransition] = useTransition();

  /* ---- month cursor — synced with ?month= URL param (shared with <MonthSelector />) ---- */
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const monthCursor = parseMonth(searchParams.get("month"));
  const monthStart = startOfMonth(monthCursor);
  const monthEnd = endOfMonth(monthCursor);
  const monthKey = format(monthCursor, "yyyy-MM");
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const monthLabel = format(monthCursor, "MMMM yyyy", { locale: es });

  const navigateToMonth = useCallback(
    (date: Date) => {
      const params = new URLSearchParams(searchParams.toString());
      if (isCurrentMonth(date)) {
        params.delete("month");
      } else {
        params.set("month", formatMonthParam(date));
      }
      const qs = params.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname);
    },
    [router, pathname, searchParams],
  );

  const goNextMonth = useCallback(
    () => navigateToMonth(addMonths(monthCursor, 1)),
    [monthCursor, navigateToMonth],
  );
  const goPrevMonth = useCallback(
    () => navigateToMonth(subMonths(monthCursor, 1)),
    [monthCursor, navigateToMonth],
  );

  /* ---- DB-backed occurrences state ---- */
  const [occurrences, setOccurrences] = useState<RecurringOccurrence[]>(initialOccurrences ?? []);
  const [isHydrated, setIsHydrated] = useState(!!initialOccurrences);

  /* ---- Track previous monthKey to detect actual changes ---- */
  const prevMonthKey = useRef(monthKey);
  const hadInitialData = useRef(!!initialOccurrences);

  /* ---- Load occurrences from DB on month change ---- */
  useEffect(() => {
    const monthChanged = prevMonthKey.current !== monthKey;
    prevMonthKey.current = monthKey;

    // On mount: skip if server provided initial data
    if (!monthChanged && hadInitialData.current) return;
    // After first real navigation, always fetch (even if returning to initial month)
    if (monthChanged) hadInitialData.current = false;

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

  /* ---- Manual refresh (for admin actions that change template state) ---- */
  const refreshOccurrences = useCallback(async () => {
    const result = await getOccurrencesForMonth(monthKey);
    if (result.success) setOccurrences(result.data);
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
    (
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

      startTransition(async () => {
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
            : item.direction === "INFLOW"
              ? "Ingreso recurrente registrado"
              : "Pago recurrente registrado";

          toast.success(msg);
        } else if (duplicates > 0) {
          toast.info("Este pago ya estaba registrado anteriormente.");
        }
      });
    },
    [todayStr, startTransition]
  );

  /* ---- skip payment ---- */
  const skipPayment = useCallback(
    (item: OccurrenceItem) => {
      // Optimistic update
      setOccurrences((prev) =>
        prev.map((o) =>
          o.id === item.occurrenceId ? { ...o, status: "skipped" as const } : o
        )
      );
      toast.success("Marcado como completado");

      startTransition(async () => {
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
        }
      });
    },
    [startTransition]
  );

  /* ---- link existing transaction ---- */
  const linkExisting = useCallback(
    (item: OccurrenceItem, transactionId: string) => {
      setBusyItems((prev) => ({ ...prev, [item.key]: true }));

      startTransition(async () => {
        const result = await linkExistingTransactionToOccurrence(
          item.occurrenceId,
          transactionId,
        );

        setBusyItems((prev) => ({ ...prev, [item.key]: false }));

        if (!result.success) {
          toast.error(result.error ?? "No se pudo vincular la transacción.");
          return;
        }

        setOccurrences((prev) =>
          prev.map((o) =>
            o.id === item.occurrenceId ? { ...o, status: "paid" as const } : o
          )
        );

        const isIncome = item.direction === "INFLOW" && !item.isDebtPayment;
        toast.success(
          isIncome
            ? "Ingreso vinculado a recurrente"
            : "Transacción vinculada a recurrente"
        );
      });
    },
    [startTransition]
  );

  /* ---- optimistic revert (for undo UI) ---- */
  const optimisticRevert = useCallback((occurrenceId: string) => {
    setOccurrences((prev) =>
      prev.map((o) =>
        o.id === occurrenceId ? { ...o, status: "pending" as const, transaction_id: null } : o
      )
    );
  }, []);

  /* ---- revert payment (full: optimistic + server action) ---- */
  const revertPayment = useCallback(
    (item: OccurrenceItem) => {
      // Optimistic
      setOccurrences((prev) =>
        prev.map((o) =>
          o.id === item.occurrenceId
            ? { ...o, status: "pending" as const, transaction_id: null }
            : o
        )
      );
      toast.success("Pago revertido a pendiente");

      startTransition(async () => {
        const result = await revertOccurrence(item.occurrenceId);
        if (!result.success) {
          // Revert optimistic update
          setOccurrences((prev) =>
            prev.map((o) =>
              o.id === item.occurrenceId
                ? { ...o, status: item.status, transaction_id: item.transactionId }
                : o
            )
          );
          toast.error(result.error ?? "No se pudo revertir el pago.");
        }
      });
    },
    [startTransition]
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
    linkExisting,
    optimisticRevert,
    revertPayment,
    busyItems,

    // Helpers
    getDateStatus,
    totalPlanned,
    refreshOccurrences,
  };
}
