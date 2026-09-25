import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { averageLastDays, isStale, mergeHistory, parseHistory, STALE_AFTER_MS } from "@/lib/fx/rate-store";

describe("rate-store history", () => {
  const today = "2026-09-25";

  it("parseHistory drops invalid and out-of-window points", () => {
    const raw = [
      { date: "2026-09-24", rate: 3300 },
      { date: "2026-05-01", rate: 3900 }, // > 90 days old
      { date: "2026-09-23", rate: 0 },
      { date: "2026-09-26", rate: 3200 }, // future
      "garbage",
    ];
    expect(parseHistory(raw, today)).toEqual([{ date: "2026-09-24", rate: 3300 }]);
  });

  it("mergeHistory lets fetched closes win and pins today to the live rate", () => {
    const merged = mergeHistory(
      [
        { date: "2026-09-23", rate: 3669 },
        { date: "2026-09-25", rate: 3669 },
      ],
      [{ date: "2026-09-23", rate: 3310 }, { date: "2026-09-24", rate: 3305 }],
      today,
      3299,
    );
    expect(merged).toEqual([
      { date: "2026-09-23", rate: 3310 },
      { date: "2026-09-24", rate: 3305 },
      { date: "2026-09-25", rate: 3299 },
    ]);
  });

  it("averageLastDays needs at least 7 points in the window", () => {
    const six = Array.from({ length: 6 }, (_, i) => ({ date: `2026-09-${20 + i}`, rate: 3300 }));
    expect(averageLastDays(six, today, 30)).toBeNull();
    const seven = [...six, { date: "2026-09-19", rate: 3370 }];
    expect(averageLastDays(seven, today, 30)).toBeCloseTo(3310);
  });

  it("isStale is keyed on fetched_at age", () => {
    const now = Date.parse("2026-09-25T15:00:00Z");
    const row = (fetchedAt: string) => ({
      pair: "USD_COP", rate: 1, avg30d: null, percentVsAvg: null, fetchedAt, history: [],
    });
    expect(isStale(null, now)).toBe(true);
    expect(isStale(row("2026-04-06T23:02:56Z"), now)).toBe(true);
    expect(isStale(row(new Date(now - STALE_AFTER_MS + 60_000).toISOString()), now)).toBe(false);
  });
});
