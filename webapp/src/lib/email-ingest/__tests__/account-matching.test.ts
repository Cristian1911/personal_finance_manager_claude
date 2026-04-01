import { describe, expect, it } from "vitest";
import { resolveSuggestedEmailAccountId } from "../account-matching";
import type { ParsedEmailTransaction } from "../../parsers/bancolombia-email";

function buildParsed(
  overrides: Partial<ParsedEmailTransaction> = {}
): ParsedEmailTransaction {
  return {
    direction: "OUTFLOW",
    amount: 22000,
    currency: "COP",
    merchant: "DUNKIN DONUTS",
    destination: null,
    card_last4: "0735",
    card_type: "T.Deb",
    transaction_date: "2026-03-26",
    transaction_time: "14:11",
    raw_line: "Compraste $22.000,00 en DUNKIN DONUTS con tu T.Deb *0735",
    pattern_type: "compra_debito",
    ...overrides,
  };
}

describe("resolveSuggestedEmailAccountId", () => {
  it("matches a debit card email to a savings account with the same mask", () => {
    const result = resolveSuggestedEmailAccountId({
      accounts: [
        {
          id: "savings-1",
          mask: "4398",
          debit_card_mask: "0735",
          account_type: "SAVINGS",

        },
      ],
      parsed: buildParsed(),
      defaultAccountId: null,
    });

    expect(result).toBe("savings-1");
  });

  it("prefers a credit card account for T.Cred notifications", () => {
    const result = resolveSuggestedEmailAccountId({
      accounts: [
        {
          id: "credit-1",
          mask: "2365",
          debit_card_mask: null,
          account_type: "CREDIT_CARD",

        },
        {
          id: "savings-1",
          mask: "2365",
          debit_card_mask: "1111",
          account_type: "SAVINGS",

        },
      ],
      parsed: buildParsed({
        card_last4: "2365",
        card_type: "T.Cred",
        pattern_type: "compra_credito",
      }),
      defaultAccountId: null,
    });

    expect(result).toBe("credit-1");
  });

  it("falls back to the ingest default account when there is no last4 match", () => {
    const result = resolveSuggestedEmailAccountId({
      accounts: [
        {
          id: "default-1",
          mask: "9999",
          debit_card_mask: null,
          account_type: "SAVINGS",

        },
      ],
      parsed: buildParsed({ card_last4: "0735" }),
      defaultAccountId: "default-1",
    });

    expect(result).toBe("default-1");
  });

  it("returns null when multiple preferred accounts share the same mask and there is no default", () => {
    const result = resolveSuggestedEmailAccountId({
      accounts: [
        {
          id: "savings-1",
          mask: "4398",
          debit_card_mask: "0735",
          account_type: "SAVINGS",

        },
        {
          id: "checking-1",
          mask: "5521",
          debit_card_mask: "0735",
          account_type: "CHECKING",

        },
      ],
      parsed: buildParsed(),
      defaultAccountId: null,
    });

    expect(result).toBeNull();
  });

  it("matches account-origin notifications against the account mask", () => {
    const result = resolveSuggestedEmailAccountId({
      accounts: [
        {
          id: "savings-1",
          mask: "****4398",
          debit_card_mask: null,
          account_type: "SAVINGS",

        },
      ],
      parsed: buildParsed({
        card_last4: "4398",
        card_type: "Cta",
        pattern_type: "transferencia",
      }),
      defaultAccountId: null,
    });

    expect(result).toBe("savings-1");
  });
});
