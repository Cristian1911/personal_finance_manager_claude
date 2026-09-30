import { diffDays, type IsoDate } from "./dates";

const cents = (n: number) => Math.round(n * 100) / 100;
const sum = (xs: number[]) => cents(xs.reduce((a, b) => a + b, 0));

/** S3-2: a card purchase at or above this enters the bill in full until the cuotas are answered. */
export const BIG_PURCHASE_THRESHOLD = 300_000;

/**
 * The card bill's minimum payment before the statement arrives (S3-6):
 * 1-cuota purchases in full + this month's cuota of each purchase + interest
 * and fees. The PDF or statement email replaces it with the exact amount.
 */
export function estimateCardMinimum(input: {
  /** Purchases in this statement period. `installments: null` = not answered yet. */
  purchases: { id: string; amount: number; installments: number | null }[];
  /** This month's cuota of purchases from earlier periods. */
  olderCuotas: number[];
  interestAndFees: number;
  bigPurchaseThreshold?: number;
}): { minimum: number; onePayment: number; cuotas: number; interestAndFees: number; askCuotas: string[] } {
  const threshold = input.bigPurchaseThreshold ?? BIG_PURCHASE_THRESHOLD;
  const full = input.purchases.filter((p) => !p.installments || p.installments <= 1);
  const split = input.purchases.filter((p) => p.installments && p.installments > 1);
  const onePayment = sum(full.map((p) => p.amount));
  const cuotas = sum([...split.map((p) => p.amount / p.installments!), ...input.olderCuotas]);
  return {
    minimum: sum([onePayment, cuotas, input.interestAndFees]),
    onePayment,
    cuotas,
    interestAndFees: input.interestAndFees,
    // Unanswered small purchases are assumed at 1 cuota; big ones get the question.
    askCuotas: input.purchases.filter((p) => p.installments == null && p.amount >= threshold).map((p) => p.id),
  };
}

/**
 * S3-5 look-ahead: the card's next bill so far and where it lands at the cut
 * if spending keeps its pace (the user's usual pace, or this period's so far).
 */
export function projectCardBillAtCut(input: {
  soFar: number;
  periodStart: IsoDate;
  cutDate: IsoDate;
  today: IsoDate;
  usualDailyPace?: number;
}): { soFar: number; atCut: number } {
  const elapsed = Math.max(1, diffDays(input.periodStart, input.today) + 1);
  const toCut = Math.max(0, diffDays(input.today, input.cutDate));
  const pace = input.usualDailyPace ?? input.soFar / elapsed;
  return { soFar: input.soFar, atCut: cents(input.soFar + pace * toCut) };
}
