/**
 * Convert a recurring amount to its monthly equivalent based on frequency.
 */
export function toMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case "WEEKLY": return amount * 4.33;
    case "BIWEEKLY": return amount * 2.17;
    case "MONTHLY": return amount;
    case "QUARTERLY": return amount / 3;
    case "ANNUAL": return amount / 12;
    default: return amount;
  }
}
