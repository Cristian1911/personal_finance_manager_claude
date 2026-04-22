import { describe, expect, it } from "vitest";
import {
  packRows,
  rowKindFor,
  type WidgetInstance,
} from "../dashboard-layout";

const w = (id: string, size: "XS" | "S" | "M" | "L"): WidgetInstance => ({
  id,
  type: "recent",
  size,
});

describe("rowKindFor", () => {
  it("maps XS to xs", () => {
    expect(rowKindFor("XS")).toBe("xs");
  });
  it("maps S and M to s (shared 2-col row)", () => {
    expect(rowKindFor("S")).toBe("s");
    expect(rowKindFor("M")).toBe("s");
  });
  it("maps L to l", () => {
    expect(rowKindFor("L")).toBe("l");
  });
});

describe("packRows", () => {
  it("packs three XS widgets into a single row", () => {
    const rows = packRows([w("a", "XS"), w("b", "XS"), w("c", "XS")]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(3);
  });

  it("packs two S widgets into a single row", () => {
    const rows = packRows([w("a", "S"), w("b", "S")]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveLength(2);
  });

  it("opens a new row when kind changes", () => {
    const rows = packRows([w("a", "XS"), w("b", "S")]);
    expect(rows).toEqual([[w("a", "XS")], [w("b", "S")]]);
  });

  it("flushes when capacity reached", () => {
    const rows = packRows([w("a", "S"), w("b", "S"), w("c", "S")]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveLength(2);
    expect(rows[1]).toHaveLength(1);
  });

  it("treats L as full row", () => {
    const rows = packRows([w("a", "L"), w("b", "S")]);
    expect(rows).toEqual([[w("a", "L")], [w("b", "S")]]);
  });
});
