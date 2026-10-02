import { describe, expect, it } from "vitest";
import { posiblesDuplicados } from "../revisar";
import type { StoredTransaction } from "../movements";

const tx = (id: string, over: Partial<StoredTransaction>): StoredTransaction => ({
  id, accountId: "a", date: "2026-10-02", amount: 32_000, direction: "OUTFLOW", currencyCode: "COP", flowClass: null, ...over,
});

describe("posiblesDuplicados (Revisar: ¿Es el mismo que anotaste?)", () => {
  it("pairs each held bank movement with the one you anotaste", () => {
    const list = posiblesDuplicados([
      tx("m", { description: "Almuerzo" }),
      tx("b", { description: "CREPES Y WAFFLES", status: "PENDING", reconciledIntoTransactionId: "m" }),
      tx("merged", { description: "Rappi", reconciledIntoTransactionId: "m" }), // merged, not held
    ], [{ id: "a", name: "Bancolombia" }]);
    expect(list).toEqual([{
      id: "b",
      banco: { title: "Crepes y Waffles", amount: "−$32.000", date: expect.any(String), account: "Bancolombia" },
      tuyo: { title: "Almuerzo", amount: "−$32.000", date: expect.any(String) },
    }]);
  });

  it("skips a held movement whose twin isn't on the phone", () => {
    expect(posiblesDuplicados([tx("b", { status: "PENDING", reconciledIntoTransactionId: "gone" })], [])).toEqual([]);
  });
});
