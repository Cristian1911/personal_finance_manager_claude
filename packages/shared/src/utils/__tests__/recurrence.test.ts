import { describe, it, expect } from "vitest";
import { getNextOccurrence, getOccurrencesBetween } from "../recurrence";

describe("getOccurrencesBetween — end-of-month anchor", () => {
  it("Jan 31 MONTHLY returns Jan 31, Feb 28, Mar 31, Apr 30, May 31", () => {
    const dates = getOccurrencesBetween(
      "2026-01-31",
      "MONTHLY",
      null,
      new Date("2026-01-01T00:00:00"),
      new Date("2026-05-31T00:00:00")
    );
    expect(dates).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
    ]);
  });

  it("Jan 30 MONTHLY clamps Feb to 28 but returns to 30 in Mar", () => {
    const dates = getOccurrencesBetween(
      "2026-01-30",
      "MONTHLY",
      null,
      new Date("2026-01-01T00:00:00"),
      new Date("2026-03-31T00:00:00")
    );
    expect(dates).toEqual(["2026-01-30", "2026-02-28", "2026-03-30"]);
  });

  it("Feb 29 ANNUAL clamps to Feb 28 in non-leap years", () => {
    const dates = getOccurrencesBetween(
      "2024-02-29",
      "ANNUAL",
      null,
      new Date("2024-01-01T00:00:00"),
      new Date("2028-12-31T00:00:00")
    );
    expect(dates).toEqual([
      "2024-02-29",
      "2025-02-28",
      "2026-02-28",
      "2027-02-28",
      "2028-02-29",
    ]);
  });

  it("Jan 31 QUARTERLY clamps to Apr 30 and recovers to Jul 31 / Oct 31", () => {
    const dates = getOccurrencesBetween(
      "2026-01-31",
      "QUARTERLY",
      null,
      new Date("2026-01-01T00:00:00"),
      new Date("2026-12-31T00:00:00")
    );
    expect(dates).toEqual([
      "2026-01-31",
      "2026-04-30",
      "2026-07-31",
      "2026-10-31",
    ]);
  });

  it("WEEKLY advances by 7 days without drift", () => {
    const dates = getOccurrencesBetween(
      "2026-01-05",
      "WEEKLY",
      null,
      new Date("2026-01-01T00:00:00"),
      new Date("2026-02-02T00:00:00")
    );
    expect(dates).toEqual([
      "2026-01-05",
      "2026-01-12",
      "2026-01-19",
      "2026-01-26",
      "2026-02-02",
    ]);
  });
});

describe("getNextOccurrence — drift anchor", () => {
  it("Jan 31 template returns Mar 31 when asked from Mar 1", () => {
    const next = getNextOccurrence(
      "2026-01-31",
      "MONTHLY",
      null,
      new Date("2026-03-01T00:00:00")
    );
    expect(next).toBe("2026-03-31");
  });

  it("Jan 31 template returns Apr 30 when asked from Apr 1", () => {
    const next = getNextOccurrence(
      "2026-01-31",
      "MONTHLY",
      null,
      new Date("2026-04-01T00:00:00")
    );
    expect(next).toBe("2026-04-30");
  });

  it("respects end date", () => {
    const next = getNextOccurrence(
      "2026-01-31",
      "MONTHLY",
      "2026-03-15",
      new Date("2026-04-01T00:00:00")
    );
    expect(next).toBeNull();
  });
});
