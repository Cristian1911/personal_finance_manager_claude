/**
 * Convert a recurring amount to its monthly equivalent based on frequency.
 */
export function toMonthlyAmount(amount: number, frequency: string): number {
  switch (frequency) {
    case "WEEKLY": return amount * 4.33;
    // Quincenal is month-anchored (two fixed days per month), so exactly 2.
    case "BIWEEKLY": return amount * 2;
    case "MONTHLY": return amount;
    case "QUARTERLY": return amount / 3;
    case "ANNUAL": return amount / 12;
    default: return amount;
  }
}
