/**
 * Pure decision logic for the "Pago compartido" (Splitwise-style shared payment)
 * feature. Framework-free so both webapp and mobile share one source of truth.
 *
 * A shared payment splits a single `total` across the payer (the user) and one
 * or more other participants. The hard invariant everything here guarantees:
 *
 *     userShare + Σ participantShares === total   (to the minor unit)
 *
 * Money is split in integer minor units (largest-remainder / Hamilton method)
 * so the legs sum EXACTLY to the total — no lost or phantom centavos/pesos.
 * COP has no decimals, so `decimals` defaults to 0; pass 2 for currencies that
 * track cents.
 */
export type SplitMethod = "equal" | "amount" | "percent";

export interface SplitParticipantInput {
  destinatario_id: string;
  /** method="amount" → the person's fixed amount; method="percent" → their % */
  value?: number;
}

export interface SplitShare {
  /** null = the user's own share; otherwise the participant's destinatario id */
  destinatario_id: string | null;
  amount: number;
}

export type SplitErrorReason =
  | "no_participants"
  | "invalid_total"
  | "negative_value"
  | "amount_sum_exceeds_total"
  | "amount_sum_mismatch"
  | "percent_out_of_range"
  | "percent_sum_mismatch";

export type ComputeSplitResult =
  | { ok: true; userShare: number; shares: SplitShare[] }
  | { ok: false; reason: SplitErrorReason; diff?: number };

// A tiny tolerance for percentage sums (user-typed percents rarely hit 100.00).
const PERCENT_EPSILON = 0.01;

function factorFor(decimals: number): number {
  return Math.pow(10, Math.max(0, Math.floor(decimals)));
}

function toMinor(value: number, factor: number): number {
  return Math.round(value * factor);
}

/**
 * Distribute `totalMinor` integer units into `count` integer shares whose sizes
 * follow `weights` (largest-remainder rounding). Shares sum EXACTLY to
 * totalMinor. With uniform weights this is an equal split; with percentage
 * weights it is a proportional split. Extra units go to the largest fractional
 * remainders first, ties broken by lowest index for determinism.
 */
function largestRemainder(totalMinor: number, weights: number[]): number[] {
  const count = weights.length;
  if (count === 0) return [];
  const weightSum = weights.reduce((s, w) => s + w, 0);
  if (weightSum <= 0) {
    // Degenerate (all-zero weights): fall back to an even split.
    return largestRemainder(totalMinor, weights.map(() => 1));
  }
  const exact = weights.map((w) => (totalMinor * w) / weightSum);
  const floors = exact.map((x) => Math.floor(x));
  let assigned = floors.reduce((s, n) => s + n, 0);
  let remainder = totalMinor - assigned;
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => (b.frac - a.frac) || (a.i - b.i));
  const result = floors.slice();
  let k = 0;
  while (remainder > 0 && k < order.length) {
    result[order[k].i] += 1;
    remainder -= 1;
    k += 1;
  }
  return result;
}

/**
 * Equal split of `total` across `participantCount` people. Returns major-unit
 * amounts summing EXACTLY to total.
 */
export function splitEqual(
  total: number,
  participantCount: number,
  decimals = 0,
): number[] {
  if (participantCount <= 0) return [];
  const factor = factorFor(decimals);
  const shares = largestRemainder(
    toMinor(total, factor),
    new Array(participantCount).fill(1),
  );
  return shares.map((m) => m / factor);
}

/**
 * Validate that custom amounts sum EXACTLY to `total` (to the minor unit).
 */
export function validateAmountSplit(
  total: number,
  shares: number[],
  decimals = 0,
): { ok: true } | { ok: false; reason: "amount_sum_mismatch"; diff: number } {
  const factor = factorFor(decimals);
  const sum = shares.reduce((s, n) => s + toMinor(n, factor), 0);
  const totalMinor = toMinor(total, factor);
  if (sum === totalMinor) return { ok: true };
  return { ok: false, reason: "amount_sum_mismatch", diff: (sum - totalMinor) / factor };
}

/**
 * Convert percentages (expected to sum to 100) into major-unit amounts that sum
 * EXACTLY to `total`, using largest-remainder rounding on the percentage
 * weights.
 */
export function percentToAmounts(
  total: number,
  percents: number[],
  decimals = 0,
): number[] {
  const factor = factorFor(decimals);
  const shares = largestRemainder(toMinor(total, factor), percents);
  return shares.map((m) => m / factor);
}

/**
 * Top-level orchestration used by both the server action and the live UI
 * preview. `participants` are the OTHER people (never the user). `userIncluded`
 * is true when the payer also consumes a share of the payment (the common
 * case — e.g. a restaurant bill shared with friends); false when the user paid
 * purely on behalf of others (the whole total becomes "me deben").
 *
 * Guarantees, on success: `userShare + Σ shares[].amount === total`.
 */
export function computeSplit(params: {
  total: number;
  method: SplitMethod;
  participants: SplitParticipantInput[];
  userIncluded: boolean;
  decimals?: number;
}): ComputeSplitResult {
  const { total, method, participants, userIncluded } = params;
  const decimals = params.decimals ?? 0;
  const factor = factorFor(decimals);
  const totalMinor = toMinor(total, factor);

  if (participants.length === 0) return { ok: false, reason: "no_participants" };
  if (!Number.isFinite(total) || totalMinor <= 0) {
    return { ok: false, reason: "invalid_total" };
  }

  const pack = (
    userShare: number,
    participantShares: number[],
  ): ComputeSplitResult => ({
    ok: true,
    userShare,
    shares: participants.map((p, i) => ({
      destinatario_id: p.destinatario_id,
      amount: participantShares[i],
    })),
  });

  if (method === "equal") {
    const count = participants.length + (userIncluded ? 1 : 0);
    const amounts = splitEqual(total, count, decimals);
    if (userIncluded) return pack(amounts[0], amounts.slice(1));
    return pack(0, amounts);
  }

  if (method === "amount") {
    const values = participants.map((p) => p.value ?? 0);
    if (values.some((v) => !Number.isFinite(v) || v < 0)) {
      return { ok: false, reason: "negative_value" };
    }
    const othersMinor = values.reduce((s, v) => s + toMinor(v, factor), 0);
    if (userIncluded) {
      const userMinor = totalMinor - othersMinor;
      if (userMinor < 0) {
        return { ok: false, reason: "amount_sum_exceeds_total", diff: -userMinor / factor };
      }
      return pack(userMinor / factor, values);
    }
    if (othersMinor !== totalMinor) {
      return {
        ok: false,
        reason: "amount_sum_mismatch",
        diff: (othersMinor - totalMinor) / factor,
      };
    }
    return pack(0, values);
  }

  // method === "percent"
  const percents = participants.map((p) => p.value ?? 0);
  if (percents.some((v) => !Number.isFinite(v) || v < 0)) {
    return { ok: false, reason: "negative_value" };
  }
  const othersPct = percents.reduce((s, v) => s + v, 0);
  if (userIncluded) {
    const userPct = 100 - othersPct;
    if (userPct < -PERCENT_EPSILON) {
      return { ok: false, reason: "percent_out_of_range", diff: -userPct };
    }
    const amounts = percentToAmounts(total, [Math.max(0, userPct), ...percents], decimals);
    return pack(amounts[0], amounts.slice(1));
  }
  if (Math.abs(othersPct - 100) > PERCENT_EPSILON) {
    return { ok: false, reason: "percent_sum_mismatch", diff: othersPct - 100 };
  }
  const amounts = percentToAmounts(total, percents, decimals);
  return pack(0, amounts);
}
