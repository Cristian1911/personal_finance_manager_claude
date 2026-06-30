// Moved to @zeta/shared so the mobile app shares the exact same analytics window
// math (parity). Re-exported here so existing webapp imports keep working.
export { rangeToWindow, nextMonths, type AnalyticsRange } from "@zeta/shared";
