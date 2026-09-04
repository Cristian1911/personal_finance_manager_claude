import { describe, expect, it } from "vitest";
import {
  accountCarriesEmailProduct,
  accountFitsEmailProduct,
  describeEmailProduct,
  emailProductKind,
  emailProductMaskToLearn,
  pickPendingEmailAccountId,
  resolveEmailAccountMatch,
  resolveSuggestedEmailAccountId,
  suggestEmailProductAccountName,
} from "../account-matching";
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

const savings = {
  id: "savings-1",
  mask: "4398",
  debit_card_mask: "0735",
  account_type: "SAVINGS" as const,
};

describe("resolveSuggestedEmailAccountId", () => {
  it("matches a debit card email to a savings account with the same mask", () => {
    const result = resolveSuggestedEmailAccountId({
      accounts: [savings],
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

  it("falls back to the ingest default account only when the alert has no mask", () => {
    const result = resolveSuggestedEmailAccountId({
      accounts: [
        {
          id: "default-1",
          mask: "9999",
          debit_card_mask: null,
          account_type: "SAVINGS",
        },
      ],
      parsed: buildParsed({ card_last4: "" }),
      defaultAccountId: "default-1",
    });

    expect(result).toBe("default-1");
  });

  it("never sends an unknown mask to the default account", () => {
    // The reported bug: a brand-new credit card (*7706) landed on the
    // default savings account because nothing else matched.
    const result = resolveSuggestedEmailAccountId({
      accounts: [{ ...savings, id: "default-1" }],
      parsed: buildParsed({
        card_last4: "7706",
        card_type: "T.Cred",
        pattern_type: "compra_credito",
      }),
      defaultAccountId: "default-1",
    });

    expect(result).toBeNull();
  });

  it("returns null when multiple preferred accounts share the same mask and there is no default", () => {
    const result = resolveSuggestedEmailAccountId({
      accounts: [
        savings,
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

  it("lets a generic 'producto' alert match a credit card by mask", () => {
    const result = resolveSuggestedEmailAccountId({
      accounts: [
        savings,
        {
          id: "credit-1",
          mask: "7706",
          debit_card_mask: null,
          account_type: "CREDIT_CARD",
        },
      ],
      parsed: buildParsed({
        card_last4: "7706",
        card_type: "producto",
        pattern_type: "pago_pse",
      }),
      defaultAccountId: null,
    });

    expect(result).toBe("credit-1");
  });
});

describe("resolveEmailAccountMatch", () => {
  it("flags an unknown credit card as unrecognized with its product kind", () => {
    const match = resolveEmailAccountMatch({
      accounts: [savings],
      parsed: buildParsed({ card_last4: "*7706", card_type: "T.Cred" }),
      defaultAccountId: "savings-1",
    });

    expect(match).toEqual({
      accountId: null,
      status: "unrecognized",
      last4: "7706",
      productKind: "credit_card",
    });
  });

  it("flags an unknown debit card even when a savings account is the default", () => {
    const match = resolveEmailAccountMatch({
      accounts: [{ ...savings, debit_card_mask: null }],
      parsed: buildParsed({ card_last4: "1234" }),
      defaultAccountId: "savings-1",
    });

    expect(match.status).toBe("unrecognized");
    expect(match.productKind).toBe("debit_card");
    expect(match.accountId).toBeNull();
  });

  it("reports the default fallback distinctly from a mask match", () => {
    const match = resolveEmailAccountMatch({
      accounts: [savings],
      parsed: buildParsed({ card_last4: "" }),
      defaultAccountId: "savings-1",
    });

    expect(match.status).toBe("default");
    expect(match.accountId).toBe("savings-1");
  });

  it("reports none when there is neither mask nor default", () => {
    const match = resolveEmailAccountMatch({
      accounts: [savings],
      parsed: buildParsed({ card_last4: "" }),
      defaultAccountId: null,
    });

    expect(match).toMatchObject({ status: "none", accountId: null });
  });

  it("resolves an ambiguous mask through the default account", () => {
    const match = resolveEmailAccountMatch({
      accounts: [
        savings,
        { id: "checking-1", mask: "5521", debit_card_mask: "0735", account_type: "CHECKING" },
      ],
      parsed: buildParsed(),
      defaultAccountId: "checking-1",
    });

    expect(match).toMatchObject({ status: "matched", accountId: "checking-1" });
  });
});

describe("pickPendingEmailAccountId", () => {
  const unrecognized = resolveEmailAccountMatch({
    accounts: [savings],
    parsed: buildParsed({ card_last4: "7706", card_type: "T.Cred" }),
    defaultAccountId: "savings-1",
  });

  it("drops a stale server suggestion when the mask is unrecognized", () => {
    expect(
      pickPendingEmailAccountId({ override: null, suggested: "savings-1", match: unrecognized }),
    ).toBeNull();
  });

  it("keeps the user's explicit choice above everything", () => {
    expect(
      pickPendingEmailAccountId({ override: "credit-1", suggested: "savings-1", match: unrecognized }),
    ).toBe("credit-1");
  });

  it("uses the server suggestion, then the client match", () => {
    const matched = resolveEmailAccountMatch({
      accounts: [savings],
      parsed: buildParsed(),
      defaultAccountId: null,
    });
    expect(
      pickPendingEmailAccountId({ override: null, suggested: "other", match: matched }),
    ).toBe("other");
    expect(
      pickPendingEmailAccountId({ override: null, suggested: null, match: matched }),
    ).toBe("savings-1");
  });
});

describe("product helpers", () => {
  it("maps card types to product kinds", () => {
    expect(emailProductKind("T.Cred")).toBe("credit_card");
    expect(emailProductKind("T.Deb")).toBe("debit_card");
    expect(emailProductKind("Cta")).toBe("account");
    expect(emailProductKind("producto")).toBe("account");
  });

  it("describes the product the way the alert names it", () => {
    expect(describeEmailProduct({ card_last4: "7706", card_type: "T.Cred" })).toBe(
      "Tarjeta de crédito *7706",
    );
    expect(describeEmailProduct({ card_last4: "0735", card_type: "T.Deb" })).toBe(
      "Tarjeta débito *0735",
    );
    expect(describeEmailProduct({ card_last4: "4398", card_type: "Cta" })).toBe("Cuenta *4398");
  });

  it("suggests a name for the account to create", () => {
    expect(suggestEmailProductAccountName({ card_last4: "7706", card_type: "T.Cred" })).toBe(
      "Bancolombia Tarjeta ****7706",
    );
    expect(suggestEmailProductAccountName({ card_last4: "4398", card_type: "Cta" })).toBe(
      "Bancolombia Ahorros ****4398",
    );
  });

  it("restricts which account types can carry a product", () => {
    expect(accountFitsEmailProduct("CREDIT_CARD", "T.Cred")).toBe(true);
    expect(accountFitsEmailProduct("SAVINGS", "T.Cred")).toBe(false);
    expect(accountFitsEmailProduct("SAVINGS", "T.Deb")).toBe(true);
    expect(accountFitsEmailProduct("CREDIT_CARD", "T.Deb")).toBe(false);
    expect(accountFitsEmailProduct("CREDIT_CARD", "producto")).toBe(true);
  });

  it("decides which mask an account learns from an alert", () => {
    const credit = { id: "credit-1", mask: null, debit_card_mask: null, account_type: "CREDIT_CARD" as const };
    const creditWithMask = { ...credit, mask: "1111" };

    // Debit cards get reissued: always take the alert's number.
    expect(
      emailProductMaskToLearn({ account: savings, cardType: "T.Deb", last4: "9999", explicit: false }),
    ).toEqual({ column: "debit_card_mask", value: "9999" });
    // Already known: nothing to do.
    expect(
      emailProductMaskToLearn({ account: savings, cardType: "T.Deb", last4: "0735", explicit: false }),
    ).toBeNull();
    // Credit card: fill an empty mask from a selector pick…
    expect(
      emailProductMaskToLearn({ account: credit, cardType: "T.Cred", last4: "7706", explicit: false }),
    ).toEqual({ column: "mask", value: "7706" });
    // …but only overwrite a different one when the user attached it on purpose.
    expect(
      emailProductMaskToLearn({ account: creditWithMask, cardType: "T.Cred", last4: "7706", explicit: false }),
    ).toBeNull();
    expect(
      emailProductMaskToLearn({ account: creditWithMask, cardType: "T.Cred", last4: "7706", explicit: true }),
    ).toEqual({ column: "mask", value: "7706" });
    // Account numbers are never overwritten, even explicitly.
    expect(
      emailProductMaskToLearn({ account: savings, cardType: "Cta", last4: "1234", explicit: true }),
    ).toBeNull();
    expect(
      emailProductMaskToLearn({ account: { ...savings, mask: null }, cardType: "Cta", last4: "1234", explicit: false }),
    ).toEqual({ column: "mask", value: "1234" });
    // Wrong account type for the product.
    expect(
      emailProductMaskToLearn({ account: savings, cardType: "T.Cred", last4: "7706", explicit: true }),
    ).toBeNull();
  });

  it("knows when an account already carries the product", () => {
    expect(accountCarriesEmailProduct(savings, "T.Deb", "0735")).toBe(true);
    expect(accountCarriesEmailProduct(savings, "Cta", "4398")).toBe(true);
    expect(accountCarriesEmailProduct(savings, "T.Cred", "4398")).toBe(false);
  });
});
