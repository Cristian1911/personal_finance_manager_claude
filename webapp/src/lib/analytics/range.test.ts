import { expect, test } from "vitest";
import { nextMonths, rangeToWindow } from "./range";

test("6M window from an anchor produces 6 ordered month keys and correct bounds", () => {
  const { from, to, months } = rangeToWindow("6M", "2026-06-15");
  expect(months).toEqual(["2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"]);
  expect(from).toBe("2026-01-01");
  expect(to).toBe("2026-06-30");
});

test("YTD window starts in January of the anchor year", () => {
  const { months } = rangeToWindow("YTD", "2026-04-10");
  expect(months).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
});

test("custom range respects explicit bounds", () => {
  const { months } = rangeToWindow({ from: "2026-03-01", to: "2026-05-31" }, "2026-06-15");
  expect(months).toEqual(["2026-03", "2026-04", "2026-05"]);
});

test("nextMonths returns the n month keys after the given month", () => {
  expect(nextMonths("2026-06", 3)).toEqual(["2026-07", "2026-08", "2026-09"]);
  expect(nextMonths("2026-11", 3)).toEqual(["2026-12", "2027-01", "2027-02"]);
});
