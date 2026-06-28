import { describe, it, expect } from "vitest";
import { sumSelectedTx } from "./budget-tx-picker-sheet";

describe("sumSelectedTx", () => {
  it("suma solo las seleccionadas", () => {
    const txs = [{ id: "a", amount: 100 }, { id: "b", amount: 50 }, { id: "c", amount: 30 }];
    expect(sumSelectedTx(txs, new Set(["a", "c"]))).toBe(130);
  });
  it("0 si nada seleccionado", () => {
    expect(sumSelectedTx([{ id: "a", amount: 100 }], new Set())).toBe(0);
  });
});
