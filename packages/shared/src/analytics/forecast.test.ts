import { expect, test } from "vitest";
import { forecast } from "./forecast";
import type { CashflowPoint } from "./types";

const history: CashflowPoint[] = [
  { month: "2026-05", income: 4000, expense: 3000, net: 1000 },
  { month: "2026-06", income: 4000, expense: 3000, net: 1000 },
];

test("projects balance forward using avg net minus extra obligations", () => {
  const out = forecast(history, 5000, [{ month: "2026-08", amount: 500 }], ["2026-07", "2026-08"]);
  expect(out).toHaveLength(2);
  expect(out[0]).toEqual({ month: "2026-07", balance: 6000, projected: true }); // 5000 + 1000
  expect(out[1]).toEqual({ month: "2026-08", balance: 6500, projected: true }); // 6000 + 1000 - 500
});

test("empty history yields flat projection minus obligations", () => {
  const out = forecast([], 1000, [], ["2026-07"]);
  expect(out[0].balance).toBe(1000);
});
