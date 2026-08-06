import { describe, it, expect } from "vitest";
import {
  classifyFlow,
  flowClassOf,
  effectiveFlowClass,
  isSpendClass,
  isIncomeClass,
  isNeutralClass,
  SPEND_CLASSES,
  INCOME_CLASSES,
  NEUTRAL_CLASSES,
  EMAIL_PATTERN_TO_FLOW,
  type FlowClass,
} from "../flow-class";

const outflow = (description: string, accountType = "SAVINGS") =>
  flowClassOf({ direction: "OUTFLOW", accountType, description });

const inflow = (description: string, accountType = "SAVINGS") =>
  flowClassOf({ direction: "INFLOW", accountType, description });

describe("the errors this module exists to fix", () => {
  it("a card payment from savings is not spending", () => {
    // Counting these as spend double-counts the purchases already on the card.
    for (const d of [
      "PAGO SUC VIRT TC VISA",
      "PAGO SUC VIRT TC AMEX PESOS",
      "PAGO SUC VIRT TC MASTER DOLAR",
      "PAGO ALTERNATIVO TARJ CRED",
      "PAGO PSE NU Compania de Fina",
      "MORA TARJETA VISA PESOS",
      "Renegociado",
      "Pago cuota",
    ]) {
      expect(outflow(d), d).toBe("DEBT_PAYMENT");
    }
  });

  it("a loan disbursed into savings is debt, not income", () => {
    // $22.441.478 was counted as income. The account is a savings account, so
    // no structural rule catches it — only the description can.
    expect(inflow("ABONO DESEMBOLSO DE CREDITO")).toBe("DEBT_DRAWDOWN");
    expect(inflow("DESEMBOLSO DE CREDITO LIBRANZA")).toBe("DEBT_DRAWDOWN");
  });

  it("a cash advance is new debt, not a purchase", () => {
    expect(outflow("AVANCE SUCURSAL VIRTUAL", "CREDIT_CARD")).toBe("DEBT_DRAWDOWN");
  });

  it("an inflow to a card is never income", () => {
    expect(inflow("cualquier cosa", "CREDIT_CARD")).toBe("DEBT_CREDIT");
    expect(inflow("cualquier cosa", "LOAN")).toBe("DEBT_CREDIT");
  });
});

describe("QR is a merchant rail in Colombia, not a transfer", () => {
  // Classifying these as transfers would erase real spending from the totals.
  it.each([
    "PAGO QR supermercado",
    "TRANSF QR",
    "TRANSF QR NEQUI SEBASTIAN PI",
    "PAGO QR Delicias camp",
  ])("%s -> SPEND", (d) => {
    expect(outflow(d)).toBe("SPEND");
  });
});

describe("transfers, cash and fees", () => {
  it.each([
    ["TRANSFERENCIA CTA SUC VIRTUAL", "SELF_TRANSFER"],
    ["TRANSFERENCIAS A NEQUI", "SELF_TRANSFER"],
    ["TRASLADO SALDOS MENORES", "SELF_TRANSFER"],
    ["RETIRO CAJERO", "CASH_WITHDRAWAL"],
    ["RETIRO CAJERO ATM EDS TEXACO", "CASH_WITHDRAWAL"],
    ["IMPTO GOBIERNO 4X1000", "BANK_FEE"],
    ["COMISION AVANCE SUCURSA", "BANK_FEE"],
    ["COBRO TRANSF QR", "BANK_FEE"],
    ["COMPRA EN EXITO", "SPEND"],
    ["PAGO QR Coffee Pink", "SPEND"],
  ])("%s -> %s", (d, expected) => {
    expect(outflow(d)).toBe(expected);
  });
});

describe("linked transfers use the counterpart account", () => {
  it("the outflow leg paying a card is DEBT_PAYMENT", () => {
    expect(
      flowClassOf({
        direction: "OUTFLOW",
        accountType: "SAVINGS",
        description: "Transferencia",
        transferGroupId: "g1",
        counterpartAccountType: "CREDIT_CARD",
      }),
    ).toBe("DEBT_PAYMENT");
  });

  it("the inflow leg landing on the card is DEBT_CREDIT", () => {
    expect(
      flowClassOf({
        direction: "INFLOW",
        accountType: "CREDIT_CARD",
        description: "Transferencia",
        transferGroupId: "g1",
        counterpartAccountType: "SAVINGS",
      }),
    ).toBe("DEBT_CREDIT");
  });

  it("savings to savings is a plain transfer", () => {
    expect(
      flowClassOf({
        direction: "OUTFLOW",
        accountType: "SAVINGS",
        description: "Transferencia",
        transferGroupId: "g1",
        counterpartAccountType: "SAVINGS",
      }),
    ).toBe("SELF_TRANSFER");
  });

  it("closes the asymmetry: same payment, linked or not, is DEBT_PAYMENT", () => {
    // Via the in-app transfer flow (linked) and via PDF import (text only).
    const linked = flowClassOf({
      direction: "OUTFLOW",
      accountType: "SAVINGS",
      description: "Transferencia",
      transferGroupId: "g1",
      counterpartAccountType: "CREDIT_CARD",
    });
    const imported = outflow("PAGO SUC VIRT TC VISA");
    expect(linked).toBe(imported);
  });
});

describe("parser hints win over text", () => {
  it("uses the email parser's pattern_type", () => {
    expect(
      flowClassOf({
        direction: "INFLOW",
        accountType: "SAVINGS",
        description: "algo ilegible",
        sourcePattern: "nomina",
      }),
    ).toBe("INCOME");
    expect(
      flowClassOf({
        direction: "OUTFLOW",
        accountType: "CREDIT_CARD",
        description: "algo ilegible",
        sourcePattern: "avance",
      }),
    ).toBe("DEBT_DRAWDOWN");
  });

  it("uses the Python parser's source_hint", () => {
    expect(
      flowClassOf({
        direction: "INFLOW",
        accountType: "SAVINGS",
        description: "sin pistas",
        sourcePattern: "DISBURSEMENT",
      }),
    ).toBe("DEBT_DRAWDOWN");
  });

  it("an unknown hint falls through to the rules instead of throwing", () => {
    expect(
      flowClassOf({
        direction: "OUTFLOW",
        accountType: "SAVINGS",
        description: "PAGO SUC VIRT TC VISA",
        sourcePattern: "algo_que_no_existe",
      }),
    ).toBe("DEBT_PAYMENT");
  });

  it("outbound `transferencia` has no hint mapping — it needs a counterpart", () => {
    expect(EMAIL_PATTERN_TO_FLOW["transferencia"]).toBeUndefined();
  });
});

describe("class sets partition the space", () => {
  it("every class belongs to exactly one bucket", () => {
    const all: FlowClass[] = [
      "INCOME", "SPEND", "DEBT_PAYMENT", "DEBT_CREDIT",
      "DEBT_DRAWDOWN", "SELF_TRANSFER", "CASH_WITHDRAWAL", "BANK_FEE",
    ];
    for (const c of all) {
      const memberships = [SPEND_CLASSES, INCOME_CLASSES, NEUTRAL_CLASSES].filter((s) =>
        s.has(c),
      );
      expect(memberships, `${c} must be in exactly one bucket`).toHaveLength(1);
    }
  });

  it("predicates are null-safe", () => {
    expect(isSpendClass(null)).toBe(false);
    expect(isIncomeClass(undefined)).toBe(false);
    expect(isNeutralClass("NOT_A_CLASS")).toBe(false);
    expect(isSpendClass("SPEND")).toBe(true);
    expect(isNeutralClass("DEBT_PAYMENT")).toBe(true);
  });
});

describe("effectiveFlowClass", () => {
  it("a user correction wins over the machine verdict", () => {
    expect(
      effectiveFlowClass({ flow_class: "SPEND", flow_class_override: "DEBT_PAYMENT" }),
    ).toBe("DEBT_PAYMENT");
  });

  it("falls back to the machine verdict, then to null", () => {
    expect(effectiveFlowClass({ flow_class: "SPEND" })).toBe("SPEND");
    expect(effectiveFlowClass({})).toBeNull();
  });
});

describe("audit trail", () => {
  it("reports which rule fired and how sure it is", () => {
    const structural = classifyFlow({
      direction: "INFLOW",
      accountType: "CREDIT_CARD",
      description: "x",
    });
    expect(structural.confidence).toBe(1);
    expect(structural.reason).toBe("structural:inflow_to_debt");

    const textual = classifyFlow({
      direction: "OUTFLOW",
      accountType: "SAVINGS",
      description: "PAGO SUC VIRT TC VISA",
    });
    expect(textual.reason).toBe("text:debt_payment");
    expect(textual.confidence).toBeLessThan(1);
  });

  it("handles empty and null descriptions without throwing", () => {
    expect(outflow("")).toBe("SPEND");
    expect(
      flowClassOf({ direction: "OUTFLOW", accountType: "SAVINGS", description: null }),
    ).toBe("SPEND");
  });
});

// ─────────────────────────────────────────────────────────────────
// Structural destination match
// ─────────────────────────────────────────────────────────────────
// Measured on production: 57 rows carry a debt-payment category, of which only
// 7 name the destination account in a way the text rules can recover. Those 7
// are what this rule is for; the rest need the category seed.
describe("destination account match", () => {
  it("names one of the user's own debt accounts -> DEBT_PAYMENT", () => {
    expect(
      flowClassOf({
        direction: "OUTFLOW",
        accountType: "SAVINGS",
        description: "bancolombia prestamo ****7507",
        matchedAccountType: "LOAN",
      }),
    ).toBe("DEBT_PAYMENT");
  });

  it("beats the plain-transfer wording", () => {
    // Without the rule this reads as SELF_TRANSFER and leaves the debt unpaid.
    expect(
      flowClassOf({
        direction: "OUTFLOW",
        accountType: "SAVINGS",
        description: "transferencia a bancolombia visa ****7022",
        matchedAccountType: "CREDIT_CARD",
      }),
    ).toBe("DEBT_PAYMENT");
  });

  it("a cash advance is still a drawdown even though its own mask matches", () => {
    // Card statements print the card's own last-4 on every line.
    expect(
      flowClassOf({
        direction: "OUTFLOW",
        accountType: "CREDIT_CARD",
        description: "avance sucursal virtual ****7507",
        matchedAccountType: "LOAN",
      }),
    ).toBe("DEBT_DRAWDOWN");
  });

  it("does not fire when the source account is itself a debt account", () => {
    expect(
      flowClassOf({
        direction: "OUTFLOW",
        accountType: "CREDIT_CARD",
        description: "compra en exito",
        matchedAccountType: "CREDIT_CARD",
      }),
    ).toBe("SPEND");
  });

  it("a non-debt destination does not make it a payment", () => {
    expect(
      flowClassOf({
        direction: "OUTFLOW",
        accountType: "SAVINGS",
        description: "compra en exito",
        matchedAccountType: "SAVINGS",
      }),
    ).toBe("SPEND");
  });
});

describe("bank-fee regex accepts both spellings of cuota manejo", () => {
  it.each(["cuota manejo tarjeta", "cuota de manejo tarjeta"])("%s -> BANK_FEE", (d) => {
    expect(flowClassOf({ direction: "OUTFLOW", accountType: "SAVINGS", description: d })).toBe(
      "BANK_FEE",
    );
  });
});
