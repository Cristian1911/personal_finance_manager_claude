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

test("MTD window spans the first of the month to the anchor day", () => {
  const { from, to, months } = rangeToWindow("MTD", "2026-06-15");
  expect(from).toBe("2026-06-01");
  expect(to).toBe("2026-06-15");
  expect(months).toEqual(["2026-06"]);
});

test("WTD window starts Monday of the anchor week and ends at the anchor", () => {
  // 2026-06-17 is a Wednesday; its week starts Monday 2026-06-15.
  const { from, to, months } = rangeToWindow("WTD", "2026-06-17");
  expect(from).toBe("2026-06-15");
  expect(to).toBe("2026-06-17");
  expect(months).toEqual(["2026-06"]);
});

test("WTD window crossing a month boundary keeps both month keys", () => {
  // 2026-07-02 is a Thursday; its week starts Monday 2026-06-29.
  const { from, to, months } = rangeToWindow("WTD", "2026-07-02");
  expect(from).toBe("2026-06-29");
  expect(to).toBe("2026-07-02");
  expect(months).toEqual(["2026-06", "2026-07"]);
});

test("custom range respects explicit bounds", () => {
  const { months } = rangeToWindow({ from: "2026-03-01", to: "2026-05-31" }, "2026-06-15");
  expect(months).toEqual(["2026-03", "2026-04", "2026-05"]);
});

test("nextMonths returns the n month keys after the given month", () => {
  expect(nextMonths("2026-06", 3)).toEqual(["2026-07", "2026-08", "2026-09"]);
  expect(nextMonths("2026-11", 3)).toEqual(["2026-12", "2027-01", "2027-02"]);
});
