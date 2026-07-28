import { describe, expect, it } from "vitest";
import { deriveAccountRow } from "./entity-row-model";

const base = {
  account_type: "SAVINGS" as const,
  currency_code: "COP" as const,
  current_balance: 180296,
  credit_limit: null,
  monthly_payment: null,
  interest_rate: null,
  last_synced_at: null,
};

describe("deriveAccountRow", () => {
  it("una cuenta de ahorro no lleva medidor", () => {
    const row = deriveAccountRow(base, { today: "2026-07-27" });
    expect(row.gauge).toBeNull();
    expect(row.trailing.tone).toBe("neutral");
    expect(row.primaryAction).toBe("none");
  });

  it("una tarjeta usa el cupo como medidor y avisa a partir del 75%", () => {
    const row = deriveAccountRow(
      {
        ...base,
        account_type: "CREDIT_CARD",
        current_balance: 5665822,
        credit_limit: 5400000,
      },
      { today: "2026-07-27" },
    );
    expect(row.gauge?.label).toBe("uso");
    expect(Math.round(row.gauge!.pct)).toBe(105);
    expect(row.gauge?.tone).toBe("alert");
    expect(row.trailing.tone).toBe("debt");
  });

  it("una tarjeta por debajo del 75% usa el tono neutro de marca", () => {
    const row = deriveAccountRow(
      {
        ...base,
        account_type: "CREDIT_CARD",
        current_balance: 1000000,
        credit_limit: 5400000,
      },
      { today: "2026-07-27" },
    );
    expect(row.gauge?.tone).toBe("brass");
  });

  it("un préstamo mide lo pagado, no lo usado", () => {
    const row = deriveAccountRow(
      {
        ...base,
        account_type: "LOAN",
        current_balance: 330339,
        credit_limit: 1000000,
        monthly_payment: 159477,
        interest_rate: 10.3,
      },
      { today: "2026-07-27" },
    );
    expect(row.gauge?.label).toBe("pagado");
    expect(row.gauge?.tone).toBe("income");
    expect(row.meta).toHaveLength(2);
    expect(row.meta[0]).toMatch(/^cuota /);
    expect(row.meta[1]).toBe("10.3% EA");
  });

  it("una obligación en cero ofrece archivar en vez de abonar", () => {
    const row = deriveAccountRow(
      { ...base, account_type: "LOAN", current_balance: 0, credit_limit: 1000000 },
      { today: "2026-07-27" },
    );
    expect(row.primaryAction).toBe("archive");
    expect(row.trailing.tone).toBe("income");
  });

  it("una obligación con saldo ofrece abonar", () => {
    const row = deriveAccountRow(
      {
        ...base,
        account_type: "CREDIT_CARD",
        current_balance: 500,
        credit_limit: 1000,
      },
      { today: "2026-07-27" },
    );
    expect(row.primaryAction).toBe("abonar");
  });

  it("marca el saldo como desactualizado a partir de 10 días", () => {
    const row = deriveAccountRow(
      { ...base, last_synced_at: "2026-07-07T12:00:00Z" },
      { today: "2026-07-27" },
    );
    expect(row.meta).toEqual(["sin actualizar 20d"]);
  });

  it("no marca desactualizado por debajo del umbral", () => {
    const row = deriveAccountRow(
      { ...base, last_synced_at: "2026-07-25T12:00:00Z" },
      { today: "2026-07-27" },
    );
    expect(row.meta).toEqual([]);
  });

  it("sin cupo registrado, un préstamo no inventa medidor", () => {
    const row = deriveAccountRow(
      {
        ...base,
        account_type: "LOAN",
        current_balance: 500000,
        credit_limit: null,
      },
      { today: "2026-07-27" },
    );
    expect(row.gauge).toBeNull();
  });
});
