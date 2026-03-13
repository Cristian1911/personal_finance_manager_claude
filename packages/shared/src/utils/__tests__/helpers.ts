import type { DebtAccount } from "../debt";

export function makeAccount(overrides: Partial<DebtAccount> = {}): DebtAccount {
  return {
    id: "acc-1",
    name: "Tarjeta Visa",
    type: "CREDIT_CARD",
    balance: 5_000_000,
    creditLimit: 10_000_000,
    interestRate: 28,
    monthlyPayment: 250_000,
    paymentDay: 15,
    cutoffDay: 5,
    currency: "COP",
    color: null,
    institutionName: null,
    currencyBreakdown: null,
    ...overrides,
  };
}
