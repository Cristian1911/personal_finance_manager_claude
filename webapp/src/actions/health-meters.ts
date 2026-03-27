"use server";

import { cache } from "react";
import { getMonthlyCashflow, getCategorySpending } from "@/actions/charts";
import { getAccounts } from "@/actions/accounts";
import { getEstimatedIncome } from "@/actions/income";
import { getLatestDebtSnapshots } from "@/actions/debt-snapshots";
import {
  classifyLevel,
  getRoastMessage,
  getWorstLevel,
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
  hasData: boolean;
}

export interface HealthMetersData {
  meters: HealthMeter[];
  summaryRoast: string;
  monthlyIncome: number | null;
  hasIncomeData: boolean;
  currency: CurrencyCode;
}

// ---------------------------------------------------------------------------
// Summary roast helper
// ---------------------------------------------------------------------------

const METER_LABELS: Record<MeterType, string> = {
  gasto: "gasto",
  deuda: "deuda",
  ahorro: "ahorro",
  colchon: "colchón de emergencia",
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
      return `Hay cosas que van bien, pero tu ${worstLabel} es crítico — eso anula el resto.`;
    }
    return `Tu ${worstLabel} está en zona crítica y necesita atención inmediata.`;
  }

  if (worstMeter.level === "alto") {
    const otherCriticos = meters.filter(
      (m) => m.type !== worstMeter.type && m.level === "critico",
    );
    if (otherCriticos.length > 0) {
      return `Múltiples áreas en rojo — tu ${worstLabel} y otros indicadores requieren atención urgente.`;
    }
    const goodMeters = meters.filter(
      (m) =>
        m.type !== worstMeter.type &&
        (m.level === "solido" || m.level === "excelente"),
    );
    if (goodMeters.length > 0) {
      const goodLabel = METER_LABELS[goodMeters[0].type];
      return `Tu ${goodLabel} está bien, pero tu ${worstLabel} es alto para tu ingreso${monthlyIncome != null ? " mensual" : ""}.`;
    }
    return `Tu ${worstLabel} está alto — hay margen para mejorar antes de que sea un problema real.`;
  }

  if (worstMeter.level === "atento") {
    return `En general vas bien — solo tu ${worstLabel} merece atención antes de que suba de nivel.`;
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
    const [cashflowData, categoryData, accountsResult, incomeEstimate, debtSnapshotsResult] =
      await Promise.all([
        getMonthlyCashflow(month, currency),
        getCategorySpending(month, currency),
        getAccounts(),
        getEstimatedIncome(currency, month),
        getLatestDebtSnapshots(),
      ]);

    const currentMonth = cashflowData[cashflowData.length - 1];
    const income = currentMonth?.income ?? 0;
    const expenses = currentMonth?.expenses ?? 0;
    const monthlyIncome = incomeEstimate?.monthlyAverage ?? null;
    const hasIncomeData = (monthlyIncome !== null && monthlyIncome > 0) || income > 0;

    const accounts = accountsResult.success ? accountsResult.data : [];

    // 2. GASTO — expense ratio
    const gastoValue = income > 0 ? (expenses / income) * 100 : 0;

    // 3. DEUDA — DTI ratio
    const { snapshotsByAccount } = debtSnapshotsResult;
    let monthlyDebtPayments = 0;
    for (const snap of snapshotsByAccount.values()) {
      monthlyDebtPayments += snap.minimum_payment ?? snap.total_payment_due ?? 0;
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

    const noDataTypes = new Set<MeterType>(hasIncomeData ? [] : ["gasto", "deuda"]);

    const meters: HealthMeter[] = meterConfigs.map(
      ({ type, value, format }) => {
        if (noDataTypes.has(type)) {
          return {
            type,
            value,
            level: classifyLevel(type, value),
            roast: "Sin datos de ingresos — configura tu ingreso mensual en ajustes para ver este indicador.",
            formattedValue: "—",
            hasData: false,
          };
        }
        const level = classifyLevel(type, value);
        return {
          type,
          value,
          level,
          roast: getRoastMessage(type, value, level, monthlyIncome ?? undefined, currency),
          formattedValue: format(value),
          hasData: true,
        };
      },
    );

    // 7. When no income data, return early with neutral summary
    if (!hasIncomeData) {
      const summaryRoast = "Configura tu ingreso mensual en ajustes para obtener un diagnóstico financiero completo.";
      return { meters, summaryRoast, monthlyIncome, hasIncomeData, currency };
    }

    // 8. Summary roast — pick the worst meter and highlight it
    const worstLevel = getWorstLevel(meters.map((m) => m.level));
    const worstMeter = meters.find((m) => m.level === worstLevel) ?? meters[0];

    const summaryRoast = buildSummaryRoast(
      meters,
      worstMeter,
      monthlyIncome,
      currency,
    );

    return { meters, summaryRoast, monthlyIncome, hasIncomeData, currency };
  },
);
