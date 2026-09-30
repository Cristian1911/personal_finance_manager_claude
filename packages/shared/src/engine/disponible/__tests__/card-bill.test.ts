import { describe, expect, it } from "vitest";
import { estimateCardMinimum, projectCardBillAtCut } from "../card-bill";

describe("estimateCardMinimum (S3-6, S3-2)", () => {
  it("Laura's Nu card: $640.000 minimum before the PDF", () => {
    const r = estimateCardMinimum({
      purchases: [
        { id: "p1", amount: 250_000, installments: 1 },
        { id: "p2", amount: 160_900, installments: 1 },
      ],
      olderCuotas: [118_000, 100_000], // Samsung cuota 4 of 12 + older purchases
      interestAndFees: 11_100,
    });
    expect(r).toMatchObject({ minimum: 640_000, onePayment: 410_900, cuotas: 218_000, interestAndFees: 11_100 });
  });

  it("a purchase in N cuotas adds this month's cuota", () => {
    const r = estimateCardMinimum({ purchases: [{ id: "tv", amount: 1_200_000, installments: 12 }], olderCuotas: [], interestAndFees: 0 });
    expect(r.minimum).toBe(100_000);
  });

  it("a purchase ≥ $300.000 without cuotas enters in full and asks '¿A cuántas cuotas?'", () => {
    const r = estimateCardMinimum({
      purchases: [{ id: "big", amount: 900_000, installments: null }, { id: "small", amount: 80_000, installments: null }],
      olderCuotas: [], interestAndFees: 0,
    });
    expect(r.minimum).toBe(980_000);
    expect(r.askCuotas).toEqual(["big"]);
  });

  it("the threshold is editable", () => {
    const r = estimateCardMinimum({ purchases: [{ id: "x", amount: 200_000, installments: null }], olderCuotas: [], interestAndFees: 0, bigPurchaseThreshold: 150_000 });
    expect(r.askCuotas).toEqual(["x"]);
  });
});

describe("projectCardBillAtCut (S3-5 look-ahead)", () => {
  it("'próxima factura ≈ $480.000 · al corte ≈ $620.000 si sigues a este ritmo'", () => {
    const r = projectCardBillAtCut({ soFar: 480_000, periodStart: "2026-09-09", cutDate: "2026-10-08", today: "2026-09-18", usualDailyPace: 7_000 });
    expect(r).toEqual({ soFar: 480_000, atCut: 620_000 });
  });

  it("without a usual pace, uses this period's pace so far", () => {
    // 10 days elapsed (9–18), $20.000 a day, 20 days to the cut.
    const r = projectCardBillAtCut({ soFar: 200_000, periodStart: "2026-09-09", cutDate: "2026-10-08", today: "2026-09-18" });
    expect(r.atCut).toBe(600_000);
  });

  it("on the cut date nothing more is projected", () => {
    expect(projectCardBillAtCut({ soFar: 300_000, periodStart: "2026-09-09", cutDate: "2026-10-08", today: "2026-10-08" }).atCut).toBe(300_000);
  });
});
