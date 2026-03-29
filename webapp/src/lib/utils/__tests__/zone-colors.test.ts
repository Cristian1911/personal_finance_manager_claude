import { describe, it, expect } from "vitest";
import {
  zoneBackground,
  zoneBorder,
  zoneTextColor,
  chipBackground,
} from "../zone-colors";

describe("zoneBackground", () => {
  it("returns hex color at 10% opacity as CSS rgba", () => {
    expect(zoneBackground("#ef4444")).toBe("rgba(239, 68, 68, 0.1)");
  });

  it("handles 3-char hex shorthand", () => {
    expect(zoneBackground("#f00")).toBe("rgba(255, 0, 0, 0.1)");
  });

  it("returns fallback for invalid hex", () => {
    expect(zoneBackground("not-a-color")).toBe("rgba(107, 114, 128, 0.1)");
  });
});

describe("zoneBorder", () => {
  it("returns hex color at 20% opacity", () => {
    expect(zoneBorder("#ef4444")).toBe("rgba(239, 68, 68, 0.2)");
  });
});

describe("chipBackground", () => {
  it("returns hex color at 15% opacity", () => {
    expect(chipBackground("#ef4444")).toBe("rgba(239, 68, 68, 0.15)");
  });
});

describe("zoneTextColor", () => {
  it("returns the original color for dark backgrounds (light text)", () => {
    expect(zoneTextColor("#ef4444")).toBe("#ef4444");
  });
});
