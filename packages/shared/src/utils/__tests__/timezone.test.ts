import { describe, it, expect } from "vitest";
import {
  buildTimeShiftHint,
  convertWallTime,
  currencyForCountry,
  currencyForTimeZone,
  describeTimeZone,
  formatUtcOffset,
  formatWallTime,
  getTimeZoneOffsetMinutes,
  inferCurrencyFromTimezone,
  isValidTimeZone,
  localWallTimeToColombia,
  zonedWallTimeToInstant,
} from "../timezone";

const BOGOTA = "America/Bogota";
const BUENOS_AIRES = "America/Argentina/Buenos_Aires";
const MADRID = "Europe/Madrid";
const NEW_YORK = "America/New_York";

describe("getTimeZoneOffsetMinutes", () => {
  it("knows Bogotá is UTC-5 year round", () => {
    expect(getTimeZoneOffsetMinutes(BOGOTA, new Date("2026-01-15T12:00:00Z"))).toBe(-300);
    expect(getTimeZoneOffsetMinutes(BOGOTA, new Date("2026-07-15T12:00:00Z"))).toBe(-300);
  });

  it("follows DST in zones that observe it", () => {
    expect(getTimeZoneOffsetMinutes(MADRID, new Date("2026-01-15T12:00:00Z"))).toBe(60);
    expect(getTimeZoneOffsetMinutes(MADRID, new Date("2026-07-15T12:00:00Z"))).toBe(120);
    expect(getTimeZoneOffsetMinutes(NEW_YORK, new Date("2026-01-15T12:00:00Z"))).toBe(-300);
    expect(getTimeZoneOffsetMinutes(NEW_YORK, new Date("2026-07-15T12:00:00Z"))).toBe(-240);
  });
});

describe("formatUtcOffset", () => {
  it("formats whole and fractional offsets", () => {
    expect(formatUtcOffset(-300)).toBe("UTC-5");
    expect(formatUtcOffset(-180)).toBe("UTC-3");
    expect(formatUtcOffset(330)).toBe("UTC+5:30");
    expect(formatUtcOffset(0)).toBe("UTC");
  });
});

describe("zonedWallTimeToInstant / formatWallTime", () => {
  it("round-trips a Bogotá wall clock", () => {
    const instant = zonedWallTimeToInstant("2026-09-11", "14:32", BOGOTA);
    expect(instant?.toISOString()).toBe("2026-09-11T19:32:00.000Z");
    expect(formatWallTime(instant!, BOGOTA)).toEqual({ date: "2026-09-11", time: "14:32" });
  });

  it("accepts HH:mm:ss and rejects garbage", () => {
    expect(zonedWallTimeToInstant("2026-09-11", "14:32:05", BOGOTA)?.toISOString()).toBe(
      "2026-09-11T19:32:05.000Z",
    );
    expect(zonedWallTimeToInstant("11/09/2026", "14:32", BOGOTA)).toBeNull();
    expect(zonedWallTimeToInstant("2026-09-11", "2pm", BOGOTA)).toBeNull();
  });
});

describe("convertWallTime", () => {
  it("shifts Bogotá → Buenos Aires by +2h", () => {
    expect(
      convertWallTime({ date: "2026-09-11", time: "12:32", fromTimeZone: BOGOTA, toTimeZone: BUENOS_AIRES }),
    ).toEqual({ date: "2026-09-11", time: "14:32" });
  });

  it("rolls the date across midnight", () => {
    // 23:30 in Bogotá is 01:30 the next day in Buenos Aires
    expect(
      convertWallTime({ date: "2026-09-11", time: "23:30", fromTimeZone: BOGOTA, toTimeZone: BUENOS_AIRES }),
    ).toEqual({ date: "2026-09-12", time: "01:30" });
    // 01:00 in Madrid (summer, UTC+2) is 18:00 the previous day in Bogotá
    expect(
      convertWallTime({ date: "2026-07-10", time: "01:00", fromTimeZone: MADRID, toTimeZone: BOGOTA }),
    ).toEqual({ date: "2026-07-09", time: "18:00" });
  });
});

describe("buildTimeShiftHint", () => {
  it("returns null when the device is in Colombia or on the same offset", () => {
    expect(buildTimeShiftHint({ date: "2026-09-11", time: "12:32", deviceTimeZone: BOGOTA })).toBeNull();
    // Lima is also UTC-5 → no shift to hint
    expect(buildTimeShiftHint({ date: "2026-09-11", time: "12:32", deviceTimeZone: "America/Lima" })).toBeNull();
    // New York in winter is UTC-5 too
    expect(buildTimeShiftHint({ date: "2026-01-11", time: "12:32", deviceTimeZone: NEW_YORK })).toBeNull();
  });

  it("returns null without a time or device tz", () => {
    expect(buildTimeShiftHint({ date: "2026-09-11", time: null, deviceTimeZone: BUENOS_AIRES })).toBeNull();
    expect(buildTimeShiftHint({ date: "2026-09-11", time: "12:32", deviceTimeZone: null })).toBeNull();
    expect(buildTimeShiftHint({ date: "2026-09-11", time: "12:32", deviceTimeZone: "Mars/Olympus" })).toBeNull();
  });

  it("describes the local clock for a traveller in Buenos Aires", () => {
    const hint = buildTimeShiftHint({ date: "2026-09-11", time: "12:32:00", deviceTimeZone: BUENOS_AIRES });
    expect(hint).toMatchObject({
      deviceLabel: "Buenos Aires",
      deviceOffsetLabel: "UTC-3",
      diffMinutes: 120,
      diffLabel: "+2 h",
      referenceTime: "12:32",
      localTime: "14:32",
      localDate: "2026-09-11",
      dateShifted: false,
    });
  });

  it("flags a date shift when the local clock crosses midnight", () => {
    const hint = buildTimeShiftHint({ date: "2026-09-11", time: "23:15", deviceTimeZone: MADRID });
    expect(hint).toMatchObject({ localTime: "06:15", localDate: "2026-09-12", dateShifted: true, diffLabel: "+7 h" });
  });

  it("handles device zones behind Colombia", () => {
    const hint = buildTimeShiftHint({ date: "2026-07-11", time: "09:00", deviceTimeZone: "America/Los_Angeles" });
    expect(hint).toMatchObject({ diffMinutes: -120, diffLabel: "-2 h", localTime: "07:00" });
  });
});

describe("localWallTimeToColombia", () => {
  it("converts a receipt time in Buenos Aires into the stored Colombian clock", () => {
    expect(localWallTimeToColombia("2026-09-11", "14:32", BUENOS_AIRES)).toEqual({
      date: "2026-09-11",
      time: "12:32",
    });
  });
});

describe("timezone labels", () => {
  it("uses Spanish labels for known zones and a readable fallback otherwise", () => {
    expect(describeTimeZone(BUENOS_AIRES)).toBe("Buenos Aires");
    expect(describeTimeZone(BOGOTA)).toBe("Bogotá");
    expect(describeTimeZone("Asia/Ho_Chi_Minh")).toBe("Ho Chi Minh");
  });

  it("validates IANA names", () => {
    expect(isValidTimeZone(BOGOTA)).toBe(true);
    expect(isValidTimeZone("Nowhere/Land")).toBe(false);
    expect(isValidTimeZone("")).toBe(false);
  });
});

describe("currency inference", () => {
  it("maps timezones to supported currencies", () => {
    expect(currencyForTimeZone(BUENOS_AIRES)).toBe("ARS");
    expect(currencyForTimeZone("America/Argentina/Jujuy")).toBe("ARS");
    expect(currencyForTimeZone(BOGOTA)).toBe("COP");
    expect(currencyForTimeZone("Asia/Tokyo")).toBeNull();
    expect(inferCurrencyFromTimezone("Asia/Tokyo")).toBe("COP");
    expect(inferCurrencyFromTimezone(null)).toBe("COP");
  });

  it("maps geocoded country names and ISO codes", () => {
    expect(currencyForCountry("Argentina")).toBe("ARS");
    expect(currencyForCountry("AR")).toBe("ARS");
    expect(currencyForCountry("Estados Unidos")).toBe("USD");
    expect(currencyForCountry("United States")).toBe("USD");
    expect(currencyForCountry("España")).toBe("EUR");
    expect(currencyForCountry("Japan")).toBeNull();
    expect(currencyForCountry(null)).toBeNull();
  });
});
