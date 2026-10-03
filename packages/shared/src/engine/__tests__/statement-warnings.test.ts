import { describe, expect, it } from "vitest";
import { statementWarnings } from "../statements";

const today = "2026-10-03";
const kinds = (w: ReturnType<typeof statementWarnings>) => w.map((x) => x.kind);

describe("statementWarnings (old or already imported, made obvious)", () => {
  it("a statement from 8 months ago is old, with its dates and year", () => {
    const [w] = statementWarnings({ from: "2025-12-30", to: "2026-01-31" }, today, []);
    expect(w.kind).toBe("old");
    expect(w.title).toBe("Este extracto es de hace 8 meses");
    expect(w.detail).toContain("30 dic 2025 – 31 ene 2026");
  });

  it("this month's statement is not old", () => {
    expect(statementWarnings({ from: "2026-08-31", to: "2026-09-30" }, today, [])).toEqual([]);
  });

  it("the same cut (± 3 days) is 'already imported', and only that", () => {
    const w = statementWarnings({ from: "2026-08-31", to: "2026-09-30" }, today, [{ periodFrom: "2026-09-01", periodTo: "2026-09-28" }]);
    expect(kinds(w)).toEqual(["already"]);
  });

  it("an overlapping period and a newer one already in", () => {
    const w = statementWarnings({ from: "2026-08-15", to: "2026-09-14" }, today, [
      { periodFrom: "2026-08-31", periodTo: "2026-09-30" },
    ]);
    expect(kinds(w)).toEqual(["overlap", "newer"]);
  });

  it("an old statement already imported says both, old first", () => {
    const w = statementWarnings({ from: "2025-12-30", to: "2026-01-31" }, today, [{ periodFrom: "2025-12-30", periodTo: "2026-01-31" }]);
    expect(kinds(w)).toEqual(["old", "already"]);
  });

  it("no cut date, no warning", () => {
    expect(statementWarnings({ from: null, to: null }, today, [])).toEqual([]);
  });
});
