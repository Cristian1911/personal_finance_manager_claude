import {
  calcUtilization,
  type DebtAccount,
} from "./debt";
import { allocateLumpSum } from "./debt-simulator";

export type PurchaseUrgency = "NECESSARY" | "USEFUL" | "IMPULSE";
export type PurchaseFundingType = "ONE_TIME" | "INSTALLMENTS";
export type PurchaseDecisionVerdict =
  | "BUY"
  | "BUY_WITH_CAUTION"
  | "WAIT"
  | "NOT_RECOMMENDED";

export type PurchaseDecisionReason = {
  severity: "positive" | "warning" | "critical";
  code:
    | "INSUFFICIENT_SPENDING_CAPACITY"
    | "NEGATIVE_BUFFER_AFTER_COMMITMENTS"
    | "LOW_BUFFER"
    | "HIGH_DEBT_UTILIZATION"
    | "HIGH_INTEREST_DRAG"
    | "BUDGET_OVERFLOW"
    | "MONTHLY_CASHFLOW_PRESSURE"
    | "UPCOMING_PAYMENT_PRESSURE"
    | "IMPULSE_PURCHASE"
    | "INSTALLMENT_PRESSURE"
    | "HEALTHY_BUFFER";
  title: string;
  detail: string;
};

export type PurchaseDecisionAlternative = {
  type: "PAY_DEBT" | "WAIT" | "REDUCE_AMOUNT" | "KEEP_BUFFER";
  title: string;
  detail: string;
};

export type PurchaseDecisionInput = {
  amount: number;
  urgency: PurchaseUrgency;
  fundingType: PurchaseFundingType;
  installments?: number | null;
  liquidCashAvailable: number;
  selectedAccountAvailable: number;
  selectedAccountType: "CHECKING" | "SAVINGS" | "CASH" | "INVESTMENT" | "CREDIT_CARD" | "OTHER";
  selectedAccountCreditLimit?: number | null;
  selectedAccountCurrentDebt?: number | null;
  monthlyIncome: number;
  monthlyExpenses: number;
  upcomingCommittedPayments: number;
  daysToNearestPayment?: number | null;
  budgetRemaining?: number | null;
  debtUtilizationPct?: number | null;
  monthlyDebtInterestCost?: number | null;
  activeDebtAccounts?: DebtAccount[];
};

export type PurchaseDecisionResult = {
  verdict: PurchaseDecisionVerdict;
  score: number;
  summary: string;
  reasons: PurchaseDecisionReason[];
  alternatives: PurchaseDecisionAlternative[];
  metrics: {
    effectiveImmediateImpact: number;
    projectedLiquidBuffer: number;
    recommendedBuffer: number;
    monthlyFreeCashflow: number;
    estimatedMonthlyInstallment: number;
    budgetRemainingAfterPurchase: number | null;
    selectedAccountUtilizationAfter: number | null;
  };
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function formatCopLike(amount: number): string {
  return Math.round(amount).toLocaleString("es-CO");
}

function getEstimatedMonthlyInstallment(input: PurchaseDecisionInput): number {
  if (input.fundingType !== "INSTALLMENTS") return 0;
  const installments = Math.max(input.installments ?? 1, 1);
  return input.amount / installments;
}

function getEffectiveImmediateImpact(input: PurchaseDecisionInput): number {
  if (input.selectedAccountType === "CREDIT_CARD") {
    return input.fundingType === "INSTALLMENTS"
      ? getEstimatedMonthlyInstallment(input)
      : 0;
  }

  return input.fundingType === "INSTALLMENTS"
    ? getEstimatedMonthlyInstallment(input)
    : input.amount;
}

function getRecommendedBuffer(input: PurchaseDecisionInput): number {
  const fromIncome = input.monthlyIncome > 0 ? input.monthlyIncome * 0.1 : 0;
  const fromCommitments = input.upcomingCommittedPayments * 0.35;
  const hardFloor = 200000;
  return Math.max(fromIncome, fromCommitments, hardFloor);
}

export function analyzePurchaseDecision(
  input: PurchaseDecisionInput
): PurchaseDecisionResult {
  const reasons: PurchaseDecisionReason[] = [];
  const alternatives: PurchaseDecisionAlternative[] = [];
  let score = 100;

  const estimatedMonthlyInstallment = round2(getEstimatedMonthlyInstallment(input));
  const effectiveImmediateImpact = round2(getEffectiveImmediateImpact(input));
  const monthlyFreeCashflow = round2(input.monthlyIncome - input.monthlyExpenses);
  const projectedLiquidBuffer = round2(
    input.liquidCashAvailable - effectiveImmediateImpact - input.upcomingCommittedPayments
  );
  const recommendedBuffer = round2(getRecommendedBuffer(input));
  const budgetRemainingAfterPurchase =
    input.budgetRemaining == null ? null : round2(input.budgetRemaining - input.amount);

  const selectedAccountUtilizationAfter =
    input.selectedAccountType === "CREDIT_CARD" && input.selectedAccountCreditLimit
      ? round2(
          calcUtilization(
            (input.selectedAccountCurrentDebt ?? 0) + input.amount,
            input.selectedAccountCreditLimit
          )
        )
      : null;

  if (input.amount > input.selectedAccountAvailable) {
    score -= 35;
    reasons.push({
      severity: "critical",
      code: "INSUFFICIENT_SPENDING_CAPACITY",
      title: "La cuenta elegida no soporta la compra",
      detail: `El medio de pago solo cubre ${formatCopLike(input.selectedAccountAvailable)} y la compra exige ${formatCopLike(input.amount)}.`,
    });
  }

  if (projectedLiquidBuffer < 0) {
    score -= 35;
    reasons.push({
      severity: "critical",
      code: "NEGATIVE_BUFFER_AFTER_COMMITMENTS",
      title: "Te quedarías corto para lo ya comprometido",
      detail: `Después de esta compra y de tus pagos próximos quedarías con un déficit estimado de ${formatCopLike(Math.abs(projectedLiquidBuffer))}.`,
    });
  } else if (projectedLiquidBuffer < recommendedBuffer) {
    score -= 18;
    reasons.push({
      severity: "warning",
      code: "LOW_BUFFER",
      title: "El colchón quedaría muy justo",
      detail: `Tras cubrir tus próximos pagos, te quedarían ${formatCopLike(projectedLiquidBuffer)} y el colchón recomendado para ti es ${formatCopLike(recommendedBuffer)}.`,
    });
  } else {
    score += 4;
    reasons.push({
      severity: "positive",
      code: "HEALTHY_BUFFER",
      title: "Tu liquidez aguanta la compra",
      detail: `Incluso después de compromisos próximos mantendrías un buffer estimado de ${formatCopLike(projectedLiquidBuffer)}.`,
    });
  }

  if (input.monthlyIncome > 0 && monthlyFreeCashflow <= 0) {
    score -= 20;
    reasons.push({
      severity: "warning",
      code: "MONTHLY_CASHFLOW_PRESSURE",
      title: "Tu mes ya viene apretado",
      detail: "Tus gastos del mes ya consumen o superan tus ingresos estimados.",
    });
  } else if (
    input.fundingType === "INSTALLMENTS" &&
    estimatedMonthlyInstallment > 0 &&
    monthlyFreeCashflow > 0 &&
    estimatedMonthlyInstallment > monthlyFreeCashflow * 0.35
  ) {
    score -= 16;
    reasons.push({
      severity: "warning",
      code: "INSTALLMENT_PRESSURE",
      title: "La cuota mensual te quita demasiada flexibilidad",
      detail: `La cuota estimada sería de ${formatCopLike(estimatedMonthlyInstallment)} y consumiría una parte material de tu flujo libre mensual.`,
    });
  }

  if (budgetRemainingAfterPurchase != null && budgetRemainingAfterPurchase < 0) {
    score -= 15;
    reasons.push({
      severity: "warning",
      code: "BUDGET_OVERFLOW",
      title: "Te sales del presupuesto de esa categoría",
      detail: `La compra te pasaría del presupuesto por ${formatCopLike(Math.abs(budgetRemainingAfterPurchase))}.`,
    });
  }

  const utilizationToEvaluate =
    selectedAccountUtilizationAfter ?? input.debtUtilizationPct ?? null;
  if (utilizationToEvaluate != null) {
    if (utilizationToEvaluate >= 85) {
      score -= 22;
      reasons.push({
        severity: "critical",
        code: "HIGH_DEBT_UTILIZATION",
        title: "Quedarías con una presión alta de deuda",
        detail: `Tu utilización proyectada subiría a ${utilizationToEvaluate.toFixed(0)}%, demasiado alta para una compra discrecional.`,
      });
    } else if (utilizationToEvaluate >= 70) {
      score -= 12;
      reasons.push({
        severity: "warning",
        code: "HIGH_DEBT_UTILIZATION",
        title: "La compra sube demasiado el uso de deuda",
        detail: `Tu utilización se movería alrededor de ${utilizationToEvaluate.toFixed(0)}%.`,
      });
    }
  }

  if ((input.monthlyDebtInterestCost ?? 0) >= 150000) {
    score -= 10;
    reasons.push({
      severity: "warning",
      code: "HIGH_INTEREST_DRAG",
      title: "Ya tienes un costo alto por intereses",
      detail: `Hoy pagas cerca de ${formatCopLike(input.monthlyDebtInterestCost ?? 0)} al mes en intereses.`,
    });
  }

  if ((input.daysToNearestPayment ?? 99) <= 7 && input.upcomingCommittedPayments > 0) {
    score -= 10;
    reasons.push({
      severity: "warning",
      code: "UPCOMING_PAYMENT_PRESSURE",
      title: "Tienes pagos muy cerca",
      detail: `En menos de una semana tienes pagos relevantes y esta compra reduce tu margen de maniobra.`,
    });
  }

  if (input.urgency === "IMPULSE") {
    score -= 14;
    reasons.push({
      severity: "warning",
      code: "IMPULSE_PURCHASE",
      title: "Suena a compra impulsiva",
      detail: "Si no es una necesidad real, el costo de oportunidad es más alto que el beneficio inmediato.",
    });
  } else if (input.urgency === "USEFUL") {
    score -= 4;
  } else {
    score += 4;
  }

  score = clamp(Math.round(score), 0, 100);

  let verdict: PurchaseDecisionVerdict = "BUY";
  if (score < 35) verdict = "NOT_RECOMMENDED";
  else if (score < 55) verdict = "WAIT";
  else if (score < 75) verdict = "BUY_WITH_CAUTION";

  const debtAccounts = input.activeDebtAccounts ?? [];
  if (debtAccounts.length > 0 && input.amount > 0) {
    const lumpSum = allocateLumpSum(debtAccounts, input.amount);
    const firstMeaningfulAllocation = lumpSum.allocations.find((item) => item.payment > 0);
    if (firstMeaningfulAllocation && lumpSum.totalMonthlyInterestSaved > 0) {
      alternatives.push({
        type: "PAY_DEBT",
        title: "Usarlo para bajar deuda te da más retorno",
        detail: `Con ese mismo monto podrías abonar a ${firstMeaningfulAllocation.accountName} y ahorrar cerca de ${formatCopLike(lumpSum.totalMonthlyInterestSaved)} al mes en intereses.`,
      });
    }
  }

  if (budgetRemainingAfterPurchase != null && budgetRemainingAfterPurchase < 0) {
    alternatives.push({
      type: "WAIT",
      title: "Espera al siguiente ciclo de presupuesto",
      detail: "Mover la compra al próximo mes evita que desarmes una categoría que ya viene tensionada.",
    });
  }

  if (projectedLiquidBuffer < recommendedBuffer) {
    const safeAmount = Math.max(
      0,
      Math.floor(input.liquidCashAvailable - input.upcomingCommittedPayments - recommendedBuffer)
    );
    if (safeAmount > 0 && safeAmount < input.amount) {
      alternatives.push({
        type: "REDUCE_AMOUNT",
        title: "Baja el ticket si de verdad la necesitas",
        detail: `Un monto cercano a ${formatCopLike(safeAmount)} preservaría mejor tu colchón.`,
      });
    } else {
      alternatives.push({
        type: "KEEP_BUFFER",
        title: "Preserva liquidez para las próximas semanas",
        detail: "Hoy el valor principal de ese dinero es darte margen frente a pagos y sorpresas, no convertirlo en gasto nuevo.",
      });
    }
  }

  if (input.urgency === "IMPULSE") {
    alternatives.push({
      type: "WAIT",
      title: "Aplica una pausa de 7 días",
      detail: "Si en una semana sigue siendo importante y la foto financiera no empeora, la decisión será más limpia.",
    });
  }

  let summary = "La compra no desordena de forma material tu flujo actual.";
  if (verdict === "NOT_RECOMMENDED") {
    summary =
      "Hoy la compra mete presión innecesaria sobre tu liquidez o tu deuda. Financiera y tácticamente, no conviene.";
  } else if (verdict === "WAIT") {
    summary =
      "La compra no está prohibida, pero hoy compite con pagos y colchón. Esperar te deja en mejor posición.";
  } else if (verdict === "BUY_WITH_CAUTION") {
    summary =
      "Puedes hacerla, pero el impacto no es neutro: perderías margen para pagos o presupuesto del mes.";
  }

  return {
    verdict,
    score,
    summary,
    reasons,
    alternatives,
    metrics: {
      effectiveImmediateImpact,
      projectedLiquidBuffer,
      recommendedBuffer,
      monthlyFreeCashflow,
      estimatedMonthlyInstallment,
      budgetRemainingAfterPurchase,
      selectedAccountUtilizationAfter,
    },
  };
}
