import { describe, expect, it } from "vitest";
import type { Account } from "@/types/domain";
import type { ParsedStatement } from "@/types/import";
import {
  describeParsedStatement,
  describeStatementFilename,
  formatStatementPeriod,
  matchStatementToAccount,
  parsedDataToStatements,
  parserBankLabel,
  statementMaskSuffix,
} from "../statement-preview";

function account(overrides: Partial<Account>): Account {
  return {
    id: "acc",
    name: "Cuenta",
    account_type: "SAVINGS",
    mask: null,
    bank_key: null,
    color: null,
    ...overrides,
  } as Account;
}

function statement(overrides: Partial<ParsedStatement>): ParsedStatement {
  return {
    bank: "bancolombia",
    statement_type: "credit_card",
    account_number: null,
    card_last_four: "5747",
    period_from: "2026-08-16",
    period_to: "2026-09-15",
    currency: "COP",
    summary: null,
    credit_card_metadata: null,
    loan_metadata: null,
    transactions: [],
    ...overrides,
  };
}

const amex = account({ id: "amex", name: "Amex Personal", account_type: "CREDIT_CARD", mask: "5747", bank_key: "bancolombia" });
const ahorros = account({ id: "ahorros", name: "Ahorros", account_type: "SAVINGS", mask: "1234" });
const accounts = [amex, ahorros];

describe("parserBankLabel", () => {
  it("maps parser slugs to display names", () => {
    expect(parserBankLabel("bancolombia")).toBe("Bancolombia");
    expect(parserBankLabel("banco_de_bogota")).toBe("Banco de Bogotá");
    expect(parserBankLabel("cooperativa_confiar")).toBe("Confiar");
  });

  it("title-cases unknown slugs", () => {
    expect(parserBankLabel("banco_nuevo")).toBe("Banco Nuevo");
    expect(parserBankLabel(null)).toBe("Banco");
  });
});

describe("statementMaskSuffix / matchStatementToAccount", () => {
  it("matches a credit card by card_last_four and account type", () => {
    expect(matchStatementToAccount(statement({}), accounts)?.id).toBe("amex");
  });

  it("matches savings by the account number's last 4 only", () => {
    const stmt = statement({ statement_type: "savings", account_number: "123-456-1234", card_last_four: "5747" });
    expect(statementMaskSuffix(stmt)).toBe("1234");
    expect(matchStatementToAccount(stmt, accounts)?.id).toBe("ahorros");
  });

  it("does not cross account types on the same mask", () => {
    const stmt = statement({ statement_type: "savings", account_number: "5747" });
    expect(matchStatementToAccount(stmt, accounts)).toBeUndefined();
  });

  it("falls back to the investment account number", () => {
    const fondo = account({ id: "fondo", account_type: "INVESTMENT", mask: "9876" });
    const stmt = statement({
      statement_type: "investment",
      card_last_four: null,
      investment_metadata: { investment_account_number: "00009876" } as ParsedStatement["investment_metadata"],
    });
    expect(matchStatementToAccount(stmt, [...accounts, fondo])?.id).toBe("fondo");
  });
});

describe("formatStatementPeriod", () => {
  it("collapses a single-month period to month + year", () => {
    expect(formatStatementPeriod("2026-09-01", "2026-09-30")).toBe("sep 2026");
  });

  it("shows both bounds for a cut cycle across months", () => {
    expect(formatStatementPeriod("2026-08-16", "2026-09-15")).toBe("16 ago – 15 sep 2026");
  });

  it("carries the year on both sides across years", () => {
    expect(formatStatementPeriod("2025-12-16", "2026-01-15")).toBe("16 dic 2025 – 15 ene 2026");
  });

  it("handles a single bound and none", () => {
    expect(formatStatementPeriod(null, "2026-09-15")).toBe("15 sep 2026");
    expect(formatStatementPeriod(null, null)).toBeNull();
  });
});

describe("describeParsedStatement", () => {
  it("summarises bank, product, period, count and matched account", () => {
    const preview = describeParsedStatement(
      statement({ transactions: [{} as ParsedStatement["transactions"][number]] }),
      accounts,
    );
    expect(preview).toMatchObject({
      bankLabel: "Bancolombia",
      bankKey: "bancolombia",
      typeLabel: "Tarjeta",
      accountType: "CREDIT_CARD",
      mask: "5747",
      periodLabel: "16 ago – 15 sep 2026",
      currency: "COP",
      transactionCount: 1,
    });
    expect(preview.account?.id).toBe("amex");
  });

  it("leaves account null when nothing matches", () => {
    const preview = describeParsedStatement(statement({ card_last_four: "0000" }), accounts);
    expect(preview.account).toBeNull();
  });
});

describe("describeStatementFilename", () => {
  it("reads product, last4 and period off a Bancolombia filename", () => {
    const preview = describeStatementFilename("Extracto_1150280600_202609_TARJETA_AMEX_5747.pdf", accounts);
    expect(preview).toMatchObject({ productLabel: "Tarjeta Amex", mask: "5747", periodLabel: "sep 2026" });
    expect(preview?.account?.id).toBe("amex");
  });

  it("humanises savings accounts and leaves ambiguous masks unmatched", () => {
    const twin = account({ id: "twin", account_type: "CREDIT_CARD", mask: "5747" });
    const preview = describeStatementFilename("Extracto_1_202608_CUENTA_AHORROS_5747.pdf", [...accounts, twin]);
    expect(preview?.productLabel).toBe("Cuenta de ahorros");
    expect(preview?.periodLabel).toBe("ago 2026");
    expect(preview?.account).toBeNull();
  });

  it("returns null for unknown filenames", () => {
    expect(describeStatementFilename("extracto.pdf", accounts)).toBeNull();
    expect(describeStatementFilename(null, accounts)).toBeNull();
  });
});

describe("parsedDataToStatements", () => {
  it("keeps only statement-shaped entries", () => {
    expect(parsedDataToStatements([statement({}), null, { foo: 1 }, "x"])).toHaveLength(1);
    expect(parsedDataToStatements({ statements: [] })).toEqual([]);
  });
});
