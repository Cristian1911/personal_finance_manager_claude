import { describe, expect, it } from "vitest";
import { countOccurrences } from "./occurrence-counts";

const TODAY = "2026-07-27";

describe("countOccurrences", () => {
  it("keeps skipped out of both paid and the denominator", () => {
    // The exact shape that produced "11 de 17" on desktop and "14 de 20" on
    // mobile for the same month: 3 skipped occurrences counted as paid.
    const rows = [
      ...Array.from({ length: 11 }, () => ({ status: "paid", occurrence_date: "2026-07-05" })),
      ...Array.from({ length: 6 }, () => ({ status: "pending", occurrence_date: "2026-07-30" })),
      ...Array.from({ length: 3 }, () => ({ status: "skipped", occurrence_date: "2026-07-10" })),
    ];

    const counts = countOccurrences(rows, TODAY);

    expect(counts.paid).toBe(11);
    expect(counts.due).toBe(17);
    expect(counts.skipped).toBe(3);
    expect(counts.pending).toBe(6);
  });

  it("counts a pending occurrence dated before today as overdue", () => {
    const counts = countOccurrences(
      [
        { status: "pending", occurrence_date: "2026-07-21" },
        { status: "pending", occurrence_date: "2026-07-27" },
        { status: "pending", occurrence_date: "2026-07-30" },
        { status: "paid", occurrence_date: "2026-07-01" },
      ],
      TODAY,
    );

    expect(counts.overdue).toBe(1);
    expect(counts.pending).toBe(3);
  });

  it("returns zeroes for an empty month", () => {
    expect(countOccurrences([], TODAY)).toEqual({
      pending: 0,
      paid: 0,
      skipped: 0,
      due: 0,
      overdue: 0,
    });
  });
});
