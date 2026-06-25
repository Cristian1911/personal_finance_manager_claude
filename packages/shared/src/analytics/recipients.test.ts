import { expect, test } from "vitest";
import { topRecipients } from "./recipients";
import type { AnalyticsConfig, AnalyticsTx } from "./types";

const cfg: AnalyticsConfig = {
  months: ["2026-05", "2026-06"],
  debtAccountIds: new Set(),
  categoryMeta: new Map(),
  destinatarioMeta: new Map([
    ["d1", { name: "Éxito", color: "#E8875A" }],
    ["d2", { name: "Rappi", color: "#937844" }],
  ]),
};
const tx = (o: Partial<AnalyticsTx>): AnalyticsTx => ({
  amount: 0,
  direction: "OUTFLOW",
  date: "2026-06-01",
  categoryId: null,
  destinatarioId: "d1",
  accountId: "a",
  expenseType: null,
  ...o,
});

test("ranks by total, computes count, share, MoM, buckets null as 'Sin asignar'", () => {
  const rows = [
    tx({ amount: 300, date: "2026-05-01", destinatarioId: "d1" }),
    tx({ amount: 100, date: "2026-06-01", destinatarioId: "d1" }), // d1 total 400, last 100, prev 300
    tx({ amount: 50, date: "2026-06-01", destinatarioId: "d2" }),
    tx({ amount: 50, date: "2026-06-01", destinatarioId: null }),
  ];
  const out = topRecipients(rows, cfg, 5);
  expect(out[0].name).toBe("Éxito");
  expect(out[0].total).toBe(400);
  expect(out[0].count).toBe(2);
  expect(out[0].momPct).toBeCloseTo(-66.666, 1); // (100-300)/300
  expect(out[0].share).toBeCloseTo(400 / 500);
  expect(out.find((r) => r.destinatarioId === null)!.name).toBe("Sin asignar");
});
