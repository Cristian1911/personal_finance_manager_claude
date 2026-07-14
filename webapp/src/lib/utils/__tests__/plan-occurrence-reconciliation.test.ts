import { describe, it, expect } from "vitest";
import {
  matchSettledOccurrencesToEntries,
  computePlanEntryRedates,
} from "../plan-occurrence-reconciliation";

const TPL = "tpl-1";
const OTHER_TPL = "tpl-2";

function entry(id: string, date: string, templateId: string | null = TPL) {
  return { id, recurring_template_id: templateId, expected_date: date };
}

function occ(date: string, status: string, templateId = TPL) {
  return { template_id: templateId, occurrence_date: date, status };
}

describe("matchSettledOccurrencesToEntries", () => {
  it("matches exact dates", () => {
    const result = matchSettledOccurrencesToEntries(
      [entry("e1", "2026-07-16")],
      [occ("2026-07-16", "paid")]
    );
    expect(result.get("e1")).toBe("paid");
  });

  it("matches a drifted entry within the ±3 day window (quincenal 14→16 fix)", () => {
    // Real-world case: entry snapshotted Jul 14 under the old 14-day quincenal
    // math; occurrence self-healed to Jul 16 (month-anchored) and got paid.
    const result = matchSettledOccurrencesToEntries(
      [entry("e1", "2026-07-14")],
      [occ("2026-07-16", "paid")]
    );
    expect(result.get("e1")).toBe("paid");
  });

  it("does not match beyond the window", () => {
    const result = matchSettledOccurrencesToEntries(
      [entry("e1", "2026-07-10")],
      [occ("2026-07-16", "paid")]
    );
    expect(result.size).toBe(0);
  });

  it("ignores pending occurrences", () => {
    const result = matchSettledOccurrencesToEntries(
      [entry("e1", "2026-07-16")],
      [occ("2026-07-16", "pending")]
    );
    expect(result.size).toBe(0);
  });

  it("maps skipped occurrences", () => {
    const result = matchSettledOccurrencesToEntries(
      [entry("e1", "2026-07-01")],
      [occ("2026-07-01", "skipped")]
    );
    expect(result.get("e1")).toBe("skipped");
  });

  it("resolves both quincenas independently (skipped 01, paid 16)", () => {
    const result = matchSettledOccurrencesToEntries(
      [entry("e1", "2026-07-01"), entry("e2", "2026-07-14")],
      [occ("2026-07-01", "skipped"), occ("2026-07-16", "paid")]
    );
    expect(result.get("e1")).toBe("skipped");
    expect(result.get("e2")).toBe("paid");
  });

  it("never settles two entries off one occurrence — exact match wins", () => {
    // Re-sync duplicate scenario: stale Jul 14 entry + fresh Jul 16 entry,
    // single paid occurrence on Jul 16.
    const result = matchSettledOccurrencesToEntries(
      [entry("stale", "2026-07-14"), entry("fresh", "2026-07-16")],
      [occ("2026-07-16", "paid")]
    );
    expect(result.get("fresh")).toBe("paid");
    expect(result.has("stale")).toBe(false);
  });

  it("picks the nearest occurrence when several are within window", () => {
    const result = matchSettledOccurrencesToEntries(
      [entry("e1", "2026-07-14")],
      [occ("2026-07-13", "skipped"), occ("2026-07-16", "paid")]
    );
    expect(result.get("e1")).toBe("skipped");
  });

  it("WEEKLY spacing (7 days, tightest case): one occurrence settles only the nearest entry", () => {
    // Windows reachable from two weekly entries are disjoint: ±3 from Jul 01
    // is [Jun 28, Jul 04]; ±3 from Jul 08 is [Jul 05, Jul 11]. An occurrence
    // on Jul 04 (diff 3 vs 4) may only settle the first.
    const result = matchSettledOccurrencesToEntries(
      [entry("e1", "2026-07-01"), entry("e2", "2026-07-08")],
      [occ("2026-07-04", "paid")]
    );
    expect(result.get("e1")).toBe("paid");
    expect(result.has("e2")).toBe(false);
  });

  it("never matches across templates", () => {
    const result = matchSettledOccurrencesToEntries(
      [entry("e1", "2026-07-16", TPL)],
      [occ("2026-07-16", "paid", OTHER_TPL)]
    );
    expect(result.size).toBe(0);
  });

  it("ignores non-recurring entries", () => {
    const result = matchSettledOccurrencesToEntries(
      [entry("e1", "2026-07-16", null)],
      [occ("2026-07-16", "paid")]
    );
    expect(result.size).toBe(0);
  });
});

describe("computePlanEntryRedates", () => {
  function redatable(
    id: string,
    date: string,
    status = "PLANNED",
    templateId: string | null = TPL
  ) {
    return { id, recurring_template_id: templateId, expected_date: date, status };
  }

  it("re-dates a stale PLANNED entry to the nearby new schedule date", () => {
    const redates = computePlanEntryRedates(
      new Map([[TPL, ["2026-07-08"]]]),
      [redatable("e1", "2026-07-05")]
    );
    expect(redates).toEqual([
      { entryId: "e1", templateId: TPL, fromDate: "2026-07-05", toDate: "2026-07-08" },
    ]);
  });

  it("leaves entries whose date is still in the schedule", () => {
    const redates = computePlanEntryRedates(
      new Map([[TPL, ["2026-07-05"]]]),
      [redatable("e1", "2026-07-05")]
    );
    expect(redates).toEqual([]);
  });

  it("never moves COMPLETED or SKIPPED entries", () => {
    const redates = computePlanEntryRedates(
      new Map([[TPL, ["2026-07-08"]]]),
      [redatable("e1", "2026-07-05", "COMPLETED"), redatable("e2", "2026-07-06", "SKIPPED")]
    );
    expect(redates).toEqual([]);
  });

  it("does not re-date beyond the ±3 day window (distinct quincenas stay apart)", () => {
    // Period 01–15 jul: schedule only produces Jul 01; the stranded Jul 14
    // entry belongs to the quincena that moved out of the period — pairing it
    // to Jul 01 would flip it onto a different obligation.
    const redates = computePlanEntryRedates(
      new Map([[TPL, ["2026-07-01"]]]),
      [redatable("e1", "2026-07-14")]
    );
    expect(redates).toEqual([]);
  });

  it("does not steal a schedule date already claimed by another entry", () => {
    const redates = computePlanEntryRedates(
      new Map([[TPL, ["2026-07-08"]]]),
      [redatable("stale", "2026-07-05"), redatable("fresh", "2026-07-08")]
    );
    expect(redates).toEqual([]);
  });

  it("pairs multiple stale entries to distinct targets", () => {
    const redates = computePlanEntryRedates(
      new Map([[TPL, ["2026-07-03", "2026-07-17"]]]),
      [redatable("e1", "2026-07-01"), redatable("e2", "2026-07-15")]
    );
    expect(redates).toEqual([
      { entryId: "e1", templateId: TPL, fromDate: "2026-07-01", toDate: "2026-07-03" },
      { entryId: "e2", templateId: TPL, fromDate: "2026-07-15", toDate: "2026-07-17" },
    ]);
  });
});
