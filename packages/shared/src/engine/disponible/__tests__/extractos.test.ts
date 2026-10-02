import { describe, expect, it } from "vitest";
import { extractosView, type StatementHistoryRow } from "../extractos";

const row = (periodTo: string, over: Partial<StatementHistoryRow> = {}): StatementHistoryRow => ({
  id: periodTo, periodFrom: null, periodTo, totalDue: 1_000_000, minimum: 60_000, dueDate: null, rate: 24.33,
  interestCharged: 20_000, purchases: 300_000, previousBalance: null, ...over,
});

describe("extractosView (a card's statements, month to month)", () => {
  const rows = [
    row("2026-08-31", { totalDue: 900_000, dueDate: "2026-09-12" }),
    row("2026-09-30", { totalDue: 1_050_000, dueDate: "2026-10-12", interestCharged: 22_500 }),
  ];

  it("newest first, each with what you owed and how it moved from the one before", () => {
    const v = extractosView(rows, "2026-10-02");
    expect(v.rows.map((r) => [r.mes, r.debes, r.cambio, r.cambioTone])).toEqual([
      ["Septiembre 2026", "$1.050.000", "+$150.000 frente a agosto", "bad"],
      ["Agosto 2026", "$900.000", null, "neutral"],
    ]);
    expect(v.rows[0]).toMatchObject({ intereses: "$22.500", minimo: "$60.000", estado: "Vence el 12 oct" });
    expect(v.rows[1]).toMatchObject({ estado: "Venció el 12 sep" });
  });

  it("tells, for one statement just imported, whether it made a payment and how the debt moved", () => {
    const v = extractosView(rows, "2026-10-02");
    expect(v.outcome("2026-09-30")).toEqual({
      pago: "Creó un pago en Pagos: mínimo $60.000, vence el 12 oct. Ya cuenta en tu Disponible.",
      deuda: "Debes $1.050.000: $150.000 más que en el extracto de agosto. Intereses del mes: $22.500.",
    });
    expect(v.outcome("2026-08-31")).toMatchObject({ pago: "No crea un pago: venció el 12 sep (es un extracto viejo)." });
  });

  it("a debt that went down reads as good news", () => {
    const v = extractosView([row("2026-08-31", { totalDue: 900_000 }), row("2026-09-30", { totalDue: 700_000 })], "2026-10-02");
    expect(v.rows[0]).toMatchObject({ cambio: "−$200.000 frente a agosto", cambioTone: "ok" });
  });
});
