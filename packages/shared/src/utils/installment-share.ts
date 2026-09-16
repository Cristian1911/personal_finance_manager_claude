/**
 * Compras a cuotas compartidas: estimar el costo total de una compra a N
 * cuotas (precio + interés) para repartirla UNA sola vez como compra completa,
 * en vez de cuota a cuota.
 *
 * El extracto solo trae el precio (`original_amount`), la cuota actual y el
 * total de cuotas; la tasa es la del producto (EA %, cabecera del extracto).
 * Con eso se aproxima una anualidad francesa (cuota fija): la cuota de capital
 * + interés y, por diferencia, el interés total. Es una estimación: el banco
 * puede liquidar sobre saldo diario o cambiar la tasa, así que la UI lo dice.
 */
import { monthlyRateFromEA } from "./debt";

export type InstallmentPlan = {
  principal: number;
  installmentTotal: number;
  /** Monthly effective rate (fraction), 0 when unknown. */
  monthlyRate: number;
  /** Fixed monthly payment (capital + interest). */
  monthlyPayment: number;
  totalInterest: number;
  /** principal + totalInterest — what the purchase really costs. */
  totalCost: number;
  /** false when the EA rate was missing/zero: interest is 0 by assumption. */
  interestKnown: boolean;
};

function roundTo(value: number, decimals: number): number {
  const f = Math.pow(10, decimals);
  return Math.round(value * f) / f;
}

export function estimateInstallmentPlan(params: {
  principal: number;
  installmentTotal: number;
  eaRatePercent: number | null | undefined;
  decimals?: number;
}): InstallmentPlan {
  const decimals = params.decimals ?? 0;
  const principal = Number(params.principal);
  const n = Math.floor(Number(params.installmentTotal));
  if (!Number.isFinite(principal) || principal <= 0 || !Number.isFinite(n) || n <= 0) {
    return {
      principal: Math.max(0, principal || 0),
      installmentTotal: Math.max(0, n || 0),
      monthlyRate: 0,
      monthlyPayment: 0,
      totalInterest: 0,
      totalCost: 0,
      interestKnown: false,
    };
  }
  const ea = params.eaRatePercent;
  if (ea == null || !Number.isFinite(ea) || ea <= 0) {
    return {
      principal,
      installmentTotal: n,
      monthlyRate: 0,
      monthlyPayment: roundTo(principal / n, decimals),
      totalInterest: 0,
      totalCost: principal,
      interestKnown: false,
    };
  }
  const i = monthlyRateFromEA(ea);
  const payment = (principal * i) / (1 - Math.pow(1 + i, -n));
  const monthlyPayment = roundTo(payment, decimals);
  const totalCost = roundTo(payment * n, decimals);
  return {
    principal,
    installmentTotal: n,
    monthlyRate: i,
    monthlyPayment,
    totalInterest: roundTo(totalCost - principal, decimals),
    totalCost,
    interestKnown: true,
  };
}

export type InstallmentShareBreakdown = {
  /** What this person owes in total (their share of totalCost). */
  shareAmount: number;
  /** Portion of shareAmount that is estimated interest. */
  shareInterest: number;
  /** Portion of shareAmount that is purchase price. */
  sharePrincipal: number;
  /** What they would pay per month if they repay in the same number of cuotas. */
  suggestedInstallment: number;
};

export function describeInstallmentShare(
  plan: InstallmentPlan,
  shareAmount: number,
  decimals = 0,
): InstallmentShareBreakdown {
  const share = Math.max(0, Number(shareAmount) || 0);
  const ratio = plan.totalCost > 0 ? plan.totalInterest / plan.totalCost : 0;
  const shareInterest = roundTo(share * ratio, decimals);
  return {
    shareAmount: share,
    shareInterest,
    sharePrincipal: roundTo(share - shareInterest, decimals),
    suggestedInstallment: plan.installmentTotal > 0 ? roundTo(share / plan.installmentTotal, decimals) : share,
  };
}
