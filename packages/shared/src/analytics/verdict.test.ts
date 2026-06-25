import { expect, test } from "vitest";
import { buildVerdict } from "./verdict";
import type { Mover, SavingsPoint } from "./types";

const savings: SavingsPoint[] = [
  { month: "2026-05", income: 4000, expense: 3360, rate: 0.16 },
  { month: "2026-06", income: 4550, expense: 3458, rate: 0.24 },
];
const movers: Mover[] = [{ categoryId: "c1", nameEs: "Restaurantes", color: "#937844", from: 348, to: 410, deltaPct: 18 }];

test("headline reports latest savings rate; sub names the top accelerating category", () => {
  const v = buildVerdict({ savings, movers, avgExpense: 3409, avgIncome: 4275 }, (n) => `$${Math.round(n)}`);
  expect(v.headline).toContain("24%");
  expect(v.sub).toContain("Restaurantes");
  expect(v.tiles).toHaveLength(3);
  expect(v.tiles[1].value).toContain("24%"); // savings tile
});
