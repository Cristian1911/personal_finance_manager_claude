"use server";

import { cache } from "react";
import { getMonthlyCashflow, getCategorySpending } from "@/actions/charts";
import { getAccounts } from "@/actions/accounts";
import { getEstimatedIncome } from "@/actions/income";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import {
  classifyLevel,
  getRoastMessage,
} from "@/lib/health-levels";
import type { CurrencyCode } from "@/types/domain";
import type { Level, MeterType } from "@/lib/health-levels";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HealthMeter {
  type: MeterType;
  value: number;
  level: Level;
  roast: string;
  formattedValue: string; // e.g. "76%" or "2.1 meses"
}

export interface HealthMetersData {
  meters: HealthMeter[];
  summaryRoast: string;
  monthlyIncome: number | null;
  currency: CurrencyCode;
}

// ---------------------------------------------------------------------------
// Summary roast helper
// ---------------------------------------------------------------------------

const METER_LABELS: Record<MeterType, string> = {
  gasto: "gasto",
  deuda: "deuda",
  ahorro: "ahorro",
  colchon: "colchon de emergencia",
};

function buildSummaryRoast(
  meters: HealthMeter[],
  worstMeter: HealthMeter,
  monthlyIncome: number | null,
  _currency: CurrencyCode,
): string {
  const allSolid = meters.every(
    (m) => m.level === "solido" || m.level === "excelente",
  );
  const allExcellent = meters.every((m) => m.level === "excelente");

  if (allExcellent) {
    return "Finanzas en orden en todos los frentes — sigue construyendo.";
  }

  if (allSolid) {
    return "Buen nivel general — mantener el ritmo es la clave.";
  }

  const worstLabel = METER_LABELS[worstMeter.type];

  if (worstMeter.level === "critico") {
    // Check if there are other good meters to contrast with
    const goodCount = meters.filter(
      (m) => m.level === "solido" || m.level === "excelente",
    ).length;
    if (goodCount >= 2) {
      return `Hay cosas que van bien, pero tu ${worstLabel} es critico — eso anula el resto.`;
    }
    return `Tu ${worstLabel} esta en zona critica y necesita atencion inmediata.`;
  }

  if (worstMeter.level === "alto") {
    const otherCriticos = meters.filter(
      (m) => m.type !== worstMeter.type && m.level === "critico",
    );
    if (otherCriticos.length > 0) {
      return `Multiples areas en rojo — tu ${worstLabel} y otros indicadores requieren atencion urgente.`;
    }
    const goodMeters = meters.filter(
      (m) =>
        m.type !== worstMeter.type &&
        (m.level === "solido" || m.level === "excelente"),
    );
    if (goodMeters.length > 0) {
      const goodLabel = METER_LABELS[goodMeters[0].type];
      return `Tu ${goodLabel} esta bien, pero tu ${worstLabel} es alto para tu ingreso${monthlyIncome != null ? " mensual" : ""}.`;
    }
    return `Tu ${worstLabel} esta alto — hay margen para mejorar antes de que sea un problema real.`;
  }

  if (worstMeter.level === "atento") {
    return `En general vas bien — solo tu ${worstLabel} merece atencion antes de que suba de nivel.`;
  }

  return "Finanzas en buen estado — sigue monitoreando.";
}

// ---------------------------------------------------------------------------
// Main action
// ---------------------------------------------------------------------------

export const getHealthMeters = cache(
  async (
    currency: CurrencyCode,
    month?: string,
  ): Promise<HealthMetersData> => {
    // 1. Parallel fetch all data
    const [cashflowData, categoryData, accountsResult, incomeEstimate] =
      await Promise.all([
        getMonthlyCashflow(month, currency),
        getCategorySpending(month, currency),
        getAccounts(),
        getEstimatedIncome(currency, month),
      ]);

    const currentMonth = cashflowData[cashflowData.length - 1];
    const income = currentMonth?.income ?? 0;
    const expenses = currentMonth?.expenses ?? 0;
    const monthlyIncome = incomeEstimate?.monthlyAverage ?? null;

    const accounts = accountsResult.success ? accountsResult.data : [];

    // 2. GASTO — expense ratio
    const gastoValue = income > 0 ? (expenses / income) * 100 : 0;

    // 3. DEUDA — DTI ratio
    // Need minimum payments from latest statement_snapshots per debt account
    const debtAccounts = accounts.filter(
      (a) => a.account_type === "CREDIT_CARD" || a.account_type === "LOAN",
    );

    let monthlyDebtPayments = 0;
    if (debtAccounts.length > 0) {
      const { supabase } = await getAuthenticatedClient();
      const debtAccountIds = debtAccounts.map((a) => a.id);
      const { data: snapshots } = await supabase
        .from("statement_snapshots")
        .select("account_id, minimum_payment, total_payment_due")
        .in("account_id", debtAccountIds)
        .order("period_to", { ascending: false });

      // Deduplicate: keep only the latest snapshot per account
      const seen = new Set<string>();
      for (const snap of snapshots ?? []) {
        if (!seen.has(snap.account_id)) {
          seen.add(snap.account_id);
          monthlyDebtPayments +=
            snap.minimum_payment ?? snap.total_payment_due ?? 0;
        }
      }
    }

    const effectiveIncome = monthlyIncome ?? income;
    const deudaValue =
      effectiveIncome > 0
        ? (monthlyDebtPayments / effectiveIncome) * 100
        : 0;

    // 4. AHORRO — savings rate
    const ahorroValue =
      income > 0 ? ((income - expenses) / income) * 100 : 0;

    // 5. COLCHON — emergency fund months (based on fixed expenses)
    const liquidAccounts = accounts.filter(
      (a) => a.account_type === "CHECKING" || a.account_type === "SAVINGS",
    );
    const liquidBalance = liquidAccounts.reduce(
      (sum, a) => sum + Math.abs(a.current_balance),
      0,
    );
    const fixedExpenses = categoryData
      .filter((c) => c.expense_type === "fixed")
      .reduce((sum, c) => sum + c.amount, 0);
    const colchonValue =
      fixedExpenses > 0 ? liquidBalance / fixedExpenses : 99;

    // 6. Build meters array
    const meterConfigs: Array<{
      type: MeterType;
      value: number;
      format: (v: number) => string;
    }> = [
      {
        type: "gasto",
        value: gastoValue,
        format: (v) => `${Math.round(v)}%`,
      },
      {
        type: "deuda",
        value: deudaValue,
        format: (v) => `${Math.round(v)}%`,
      },
      {
        type: "ahorro",
        value: ahorroValue,
        format: (v) => `${Math.round(v)}%`,
      },
      {
        type: "colchon",
        value: Math.min(colchonValue, 99),
        format: (v) =>
          v >= 99 ? "12+ meses" : `${v.toFixed(1)} meses`,
      },
    ];

    const meters: HealthMeter[] = meterConfigs.map(
      ({ type, value, format }) => {
        const level = classifyLevel(type, value);
        return {
          type,
          value,
          level,
          roast: getRoastMessage(
            type,
            value,
            level,
            monthlyIncome ?? undefined,
            currency,
          ),
          formattedValue: format(value),
        };
      },
    );

    // 7. Summary roast — pick the worst meter and highlight it
    const levelPriority: Record<Level, number> = {
      critico: 0,
      alto: 1,
      atento: 2,
      solido: 3,
      excelente: 4,
    };
    const worstMeter = meters.reduce((worst, m) =>
      levelPriority[m.level] < levelPriority[worst.level] ? m : worst,
    );

    const summaryRoast = buildSummaryRoast(
      meters,
      worstMeter,
      monthlyIncome,
      currency,
    );

    return { meters, summaryRoast, monthlyIncome, currency };
  },
);
