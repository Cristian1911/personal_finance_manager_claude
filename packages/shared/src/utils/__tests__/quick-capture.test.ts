import { describe, expect, it } from "vitest";
import { parseQuickCaptureText } from "../quick-capture";

const now = new Date("2026-09-18T15:00:00Z");
const amount = (text: string) => {
  const r = parseQuickCaptureText(text, { now });
  return r.success ? r.data.amount : null;
};

describe("parseQuickCaptureText amounts", () => {
  it.each([
    ["gasté 300 mil en mercado", 300_000],
    ["gasté 45 mil almuerzo", 45_000],
    ["pagué 2 m de arriendo", 2_000_000],
    ["gasté 20k taxi", 20_000],
    ["gasté 25.000 en tostao", 25_000],
    ["gasté 20000 en taxi", 20_000],
    ["el 15 gasté 80000 en mercado", 80_000],
  ])("%s → %d", (text, expected) => expect(amount(text)).toBe(expected));
});
