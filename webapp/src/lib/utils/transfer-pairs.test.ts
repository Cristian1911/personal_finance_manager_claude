import { describe, expect, it } from "vitest";
import { groupTransferPairs, type TransferLeg } from "./transfer-pairs";

const tx = (id: string, direction: "INFLOW" | "OUTFLOW", group: string | null = null): TransferLeg => ({
  id,
  direction,
  transfer_group_id: group,
});

describe("groupTransferPairs", () => {
  it("leaves plain transactions alone", () => {
    const items = groupTransferPairs([tx("a", "OUTFLOW"), tx("b", "INFLOW")]);
    expect(items).toEqual([
      { kind: "single", tx: tx("a", "OUTFLOW") },
      { kind: "single", tx: tx("b", "INFLOW") },
    ]);
  });

  it("collapses a complete pair at the position of its first leg", () => {
    const items = groupTransferPairs([
      tx("out", "OUTFLOW", "g1"),
      tx("other", "OUTFLOW"),
      tx("in", "INFLOW", "g1"),
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      kind: "pair",
      tx: tx("out", "OUTFLOW", "g1"),
      counterpart: tx("in", "INFLOW", "g1"),
    });
    expect(items[1]).toEqual({ kind: "single", tx: tx("other", "OUTFLOW") });
  });

  it("keeps a lone leg as a single when its partner is not available", () => {
    // The case an account filter, a page boundary, or a ±3-day gap produces.
    const items = groupTransferPairs([tx("out", "OUTFLOW", "g1")]);
    expect(items).toEqual([{ kind: "single", tx: tx("out", "OUTFLOW", "g1") }]);
  });

  it("does not pair a malformed group", () => {
    // Two OUTFLOWs sharing a group should never render as origin → destination.
    const items = groupTransferPairs([tx("a", "OUTFLOW", "g1"), tx("b", "OUTFLOW", "g1")]);
    expect(items.every((i) => i.kind === "single")).toBe(true);
    expect(items).toHaveLength(2);

    // Neither should a group with a third leg.
    const three = groupTransferPairs([
      tx("a", "OUTFLOW", "g2"),
      tx("b", "INFLOW", "g2"),
      tx("c", "INFLOW", "g2"),
    ]);
    expect(three.every((i) => i.kind === "single")).toBe(true);
    expect(three).toHaveLength(3);
  });

  it("completes a split pair from extraLegs without emitting the extra as a row", () => {
    // The page-boundary case: the partner sits on page 2 and is fetched separately.
    const onPage = [tx("out", "OUTFLOW", "g1"), tx("plain", "OUTFLOW")];
    const items = groupTransferPairs(onPage, [tx("in", "INFLOW", "g1")]);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      kind: "pair",
      tx: tx("out", "OUTFLOW", "g1"),
      counterpart: tx("in", "INFLOW", "g1"),
    });
  });

  it("anchors the pair on the leg that is on the page", () => {
    // Under an account filter only one leg is in the feed; every action, link and
    // date on the row must belong to that leg, not to the fetched counterpart.
    const items = groupTransferPairs([tx("in", "INFLOW", "g1")], [tx("out", "OUTFLOW", "g1")]);
    expect(items[0]).toEqual({
      kind: "pair",
      tx: tx("in", "INFLOW", "g1"),
      counterpart: tx("out", "OUTFLOW", "g1"),
    });
  });

  it("emits a pair once even when extraLegs repeats what the page already has", () => {
    // getTransferLegs returns every leg of the group, on-page ones included; a
    // second emission would duplicate the row under another date header.
    const onPage = [tx("out", "OUTFLOW", "g1"), tx("in", "INFLOW", "g1")];
    const items = groupTransferPairs(onPage, onPage);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("pair");
  });

  it("ignores extra legs for groups the page does not show", () => {
    const items = groupTransferPairs([tx("plain", "OUTFLOW")], [
      tx("out", "OUTFLOW", "g9"),
      tx("in", "INFLOW", "g9"),
    ]);
    expect(items).toEqual([{ kind: "single", tx: tx("plain", "OUTFLOW") }]);
  });

  it("emits each transaction exactly once", () => {
    const input = [
      tx("out1", "OUTFLOW", "g1"),
      tx("in1", "INFLOW", "g1"),
      tx("plain", "OUTFLOW"),
      tx("out2", "OUTFLOW", "g2"),
      tx("in2", "INFLOW", "g2"),
    ];
    const seen = groupTransferPairs(input).flatMap((i) =>
      i.kind === "pair" ? [i.tx.id, i.counterpart.id] : [i.tx.id],
    );
    expect(seen.sort()).toEqual(input.map((t) => t.id).sort());
  });
});
