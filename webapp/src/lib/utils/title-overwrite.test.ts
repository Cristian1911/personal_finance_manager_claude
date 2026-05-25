import { describe, it, expect } from "vitest";
import { shouldOverwriteTitle } from "./title-overwrite";

describe("shouldOverwriteTitle", () => {
  it("overwrites when the title is not locked", () => {
    expect(shouldOverwriteTitle({ titleLocked: false, overwriteTitle: false })).toBe(true);
  });
  it("does NOT overwrite a locked title by default", () => {
    expect(shouldOverwriteTitle({ titleLocked: true, overwriteTitle: false })).toBe(false);
  });
  it("overwrites a locked title only with explicit opt-in", () => {
    expect(shouldOverwriteTitle({ titleLocked: true, overwriteTitle: true })).toBe(true);
  });
});
