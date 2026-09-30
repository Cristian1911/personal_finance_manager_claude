import { describe, expect, it } from "vitest";
import { computePayCycle } from "../cycle";

const SEMI = { kind: "semimonthly", days: [15, 30] } as const;

describe("computePayCycle", () => {
  it("Laura: paid 15 and 30, today 18 Sep → cycle 15–29 Sep, 12 days left including today", () => {
    const c = computePayCycle({ schedule: SEMI, today: "2026-09-18", salaryArrivals: ["2026-09-15"] });
    expect(c).toMatchObject({ start: "2026-09-15", end: "2026-09-29", nextPayday: "2026-09-30", days: 15, daysLeft: 12, startsOnExpectedDate: false });
  });

  it("the second half of the month runs 30 → 14", () => {
    const c = computePayCycle({ schedule: SEMI, today: "2026-10-05", salaryArrivals: ["2026-09-30"] });
    expect(c).toMatchObject({ start: "2026-09-30", end: "2026-10-14", nextPayday: "2026-10-15", days: 15, daysLeft: 10 });
  });

  it("a payday on a weekend moves to the business day before (15 Nov 2026 is a Sunday)", () => {
    const c = computePayCycle({ schedule: SEMI, today: "2026-11-14" });
    expect(c.start).toBe("2026-11-13");
    expect(c.end).toBe("2026-11-29");
    expect(c.nextPayday).toBe("2026-11-30");
  });

  it("the previous cycle ends the day before the moved payday", () => {
    const c = computePayCycle({ schedule: SEMI, today: "2026-11-12" });
    expect(c.start).toBe("2026-10-30");
    expect(c.end).toBe("2026-11-12");
    expect(c.nextPayday).toBe("2026-11-13");
  });

  it("a payday on a holiday moves to the business day before", () => {
    const c = computePayCycle({ schedule: SEMI, today: "2026-10-20", holidays: ["2026-10-15"] });
    expect(c.start).toBe("2026-10-14");
  });

  it("day 30 in February clamps to the month's last day, then to the business day before", () => {
    // 28 Feb 2027 is a Sunday → Friday 26.
    const c = computePayCycle({ schedule: SEMI, today: "2027-02-27" });
    expect(c.start).toBe("2027-02-26");
    expect(c.end).toBe("2027-03-14");
  });

  it("the cycle starts when the salary arrived early, even before the expected payday", () => {
    const c = computePayCycle({ schedule: SEMI, today: "2026-09-29", salaryArrivals: ["2026-09-28"] });
    expect(c).toMatchObject({ start: "2026-09-28", end: "2026-10-14", startsOnExpectedDate: false });
  });

  it("an arrival more than 5 days early is not this payday's salary", () => {
    const c = computePayCycle({ schedule: SEMI, today: "2026-09-26", salaryArrivals: ["2026-09-24"] });
    expect(c.start).toBe("2026-09-15");
  });

  it("a salary a few days late clears the '~' without moving the cycle's start", () => {
    const c = computePayCycle({ schedule: SEMI, today: "2026-09-18", salaryArrivals: ["2026-09-16"] });
    expect(c).toMatchObject({ start: "2026-09-15", startsOnExpectedDate: false });
  });

  it("without an arrival the cycle starts on the expected date, flagged for the '~'", () => {
    const c = computePayCycle({ schedule: SEMI, today: "2026-09-16" });
    expect(c).toMatchObject({ start: "2026-09-15", startsOnExpectedDate: true });
  });

  it("monthly on the 1st", () => {
    const c = computePayCycle({ schedule: { kind: "monthly", day: 1 }, today: "2026-09-18" });
    // 1 Nov 2026 is a Sunday → Friday 30 Oct.
    expect(c).toMatchObject({ start: "2026-09-01", end: "2026-09-30", nextPayday: "2026-10-01", days: 30 });
    expect(computePayCycle({ schedule: { kind: "monthly", day: 1 }, today: "2026-10-31" }).start).toBe("2026-10-30");
  });

  it("biweekly from a known payday", () => {
    const c = computePayCycle({ schedule: { kind: "biweekly", anchor: "2026-09-04" }, today: "2026-09-20" });
    expect(c).toMatchObject({ start: "2026-09-18", end: "2026-10-01", nextPayday: "2026-10-02", days: 14 });
  });

  it("irregular income: the cycle is the calendar month", () => {
    const c = computePayCycle({ schedule: { kind: "irregular" }, today: "2026-02-10" });
    expect(c).toMatchObject({ start: "2026-02-01", end: "2026-02-28", nextPayday: null, days: 28, daysLeft: 19, irregular: true });
  });
});
