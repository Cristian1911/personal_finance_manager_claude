import { describe, it, expect } from "vitest";
import { pairOccurrencesToEntries } from "../plan-occurrence-reconciliation";

const TPL = "tpl-1";
const OTHER_TPL = "tpl-2";

function entry(id: string, date: string, templateId: string | null = TPL) {
  return { id, recurring_template_id: templateId, expected_date: date };
}

function occ(id: string, date: string, status: string, templateId = TPL) {
  return { id, template_id: templateId, occurrence_date: date, status };
}

describe("pairOccurrencesToEntries", () => {
  it("pairs exact dates", () => {
    const result = pairOccurrencesToEntries(
      [entry("e1", "2026-07-16")],
      [occ("o1", "2026-07-16", "paid")]
    );
    expect(result.get("e1")?.id).toBe("o1");
    expect(result.get("e1")?.status).toBe("paid");
  });

  it("pairs a drifted entry within the ±3 day window (quincenal 14→16 fix)", () => {
    // Real-world case: entry snapshotted Jul 14 under the old 14-day quincenal
    // math; occurrence self-healed to Jul 16 (month-anchored) and got paid.
    const result = pairOccurrencesToEntries(
      [entry("e1", "2026-07-14")],
      [occ("o1", "2026-07-16", "paid")]
    );
    expect(result.get("e1")?.id).toBe("o1");
  });

  it("does not pair beyond the window", () => {
    const result = pairOccurrencesToEntries(
      [entry("e1", "2026-07-10")],
      [occ("o1", "2026-07-16", "paid")]
    );
    expect(result.size).toBe(0);
  });

  it("pairs pending occurrences too — the FK link is status-agnostic", () => {
    const result = pairOccurrencesToEntries(
      [entry("e1", "2026-07-16")],
      [occ("o1", "2026-07-16", "pending")]
    );
    expect(result.get("e1")?.status).toBe("pending");
  });

  it("resolves both quincenas independently (skipped 01, paid 16)", () => {
    const result = pairOccurrencesToEntries(
      [entry("e1", "2026-07-01"), entry("e2", "2026-07-14")],
      [occ("o1", "2026-07-01", "skipped"), occ("o2", "2026-07-16", "paid")]
    );
    expect(result.get("e1")?.status).toBe("skipped");
    expect(result.get("e2")?.status).toBe("paid");
  });

  it("never pairs two entries to one occurrence — exact match wins", () => {
    // Re-sync duplicate scenario: stale Jul 14 entry + fresh Jul 16 entry,
    // single paid occurrence on Jul 16.
    const result = pairOccurrencesToEntries(
      [entry("stale", "2026-07-14"), entry("fresh", "2026-07-16")],
      [occ("o1", "2026-07-16", "paid")]
    );
    expect(result.get("fresh")?.id).toBe("o1");
    expect(result.has("stale")).toBe(false);
  });

  it("picks the nearest occurrence when several are within window", () => {
    const result = pairOccurrencesToEntries(
      [entry("e1", "2026-07-14")],
      [occ("o1", "2026-07-13", "skipped"), occ("o2", "2026-07-16", "paid")]
    );
    expect(result.get("e1")?.id).toBe("o1");
  });

  it("WEEKLY spacing (7 days, tightest case): one occurrence pairs only the nearest entry", () => {
    // Windows reachable from two weekly entries are disjoint: ±3 from Jul 01
    // is [Jun 28, Jul 04]; ±3 from Jul 08 is [Jul 05, Jul 11]. An occurrence
    // on Jul 04 (diff 3 vs 4) may only pair with the first.
    const result = pairOccurrencesToEntries(
      [entry("e1", "2026-07-01"), entry("e2", "2026-07-08")],
      [occ("o1", "2026-07-04", "paid")]
    );
    expect(result.get("e1")?.id).toBe("o1");
    expect(result.has("e2")).toBe(false);
  });

  it("never pairs across templates", () => {
    const result = pairOccurrencesToEntries(
      [entry("e1", "2026-07-16", TPL)],
      [occ("o1", "2026-07-16", "paid", OTHER_TPL)]
    );
    expect(result.size).toBe(0);
  });

  it("ignores non-recurring entries", () => {
    const result = pairOccurrencesToEntries(
      [entry("e1", "2026-07-16", null)],
      [occ("o1", "2026-07-16", "paid")]
    );
    expect(result.size).toBe(0);
  });

  it("is deterministic regardless of input order", () => {
    const entries = [entry("e2", "2026-07-15"), entry("e1", "2026-07-13")];
    const occurrences = [
      occ("o2", "2026-07-16", "paid"),
      occ("o1", "2026-07-12", "pending"),
    ];
    const result = pairOccurrencesToEntries(entries, occurrences);
    // e1 (Jul 13) is nearer to o1 (Jul 12, diff 1); e2 (Jul 15) → o2 (diff 1).
    expect(result.get("e1")?.id).toBe("o1");
    expect(result.get("e2")?.id).toBe("o2");
  });
});
