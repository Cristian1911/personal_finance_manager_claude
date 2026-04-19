/**
 * Credit card minimum-payment projection math.
 *
 * Given balance B, annual EA rate r, and minimum monthly payment M,
 * simulates paying only the minimum for the next 12 months.
 *
 * Monthly rate derived from EA: r_mo = (1 + r) ** (1/12) - 1
 *
 * Returns growing=true when the minimum doesn't cover monthly interest;
 * in that case the UI should hide the 12-month numbers and warn the user.
 */

export type CcMinProjection = {
  months: number;
  interestAccrued: number;
  remainingBalance: number;
  growing: boolean;
};

export function projectMinimumPayoff12mo(
  balance: number,
  annualEA: number,
  minPayment: number,
): CcMinProjection | null {
  if (
    !Number.isFinite(balance) ||
    !Number.isFinite(annualEA) ||
    !Number.isFinite(minPayment) ||
    balance <= 0 ||
    annualEA < 0 ||
    minPayment <= 0
  ) {
    return null;
  }

  const rMo = Math.pow(1 + annualEA, 1 / 12) - 1;

  // Minimum doesn't cover first-month interest — balance grows.
  if (minPayment <= balance * rMo) {
    return {
      months: 12,
      interestAccrued: 0,
      remainingBalance: balance,
      growing: true,
    };
  }

  let current = balance;
  let interest = 0;
  const months = 12;

  for (let i = 0; i < months; i++) {
    const monthInterest = current * rMo;
    interest += monthInterest;
    current = current + monthInterest - minPayment;
    if (current < 0) current = 0;
  }

  return {
    months,
    interestAccrued: interest,
    remainingBalance: current,
    growing: false,
  };
}
