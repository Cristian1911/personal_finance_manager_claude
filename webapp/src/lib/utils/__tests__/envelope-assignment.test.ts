import { describe, it, expect } from "vitest";
import {
  clampAssignmentAmount,
  findExistingAssignment,
  computeExpenseRemainder,
  buildJarCapacityPreview,
} from "../envelope-assignment";

describe("clampAssignmentAmount", () => {
  it("returns requested when both sides have capacity", () => {
    expect(
      clampAssignmentAmount({ envelopeRemaining: 1000, expenseRemaining: 500, requested: 300 }),
    ).toBe(300);
  });

  it("clamps to envelope remaining when envelope is the tighter side", () => {
    expect(
      clampAssignmentAmount({ envelopeRemaining: 200, expenseRemaining: 500, requested: 500 }),
    ).toBe(200);
  });

  it("clamps to expense remaining when expense is the tighter side", () => {
    expect(
      clampAssignmentAmount({ envelopeRemaining: 1000, expenseRemaining: 150, requested: 500 }),
    ).toBe(150);
  });

  it("returns 0 when envelope is full", () => {
    expect(
      clampAssignmentAmount({ envelopeRemaining: 0, expenseRemaining: 500, requested: 500 }),
    ).toBe(0);
  });

  it("returns 0 when expense is fully assigned", () => {
    expect(
      clampAssignmentAmount({ envelopeRemaining: 1000, expenseRemaining: 0, requested: 500 }),
    ).toBe(0);
  });

  it("floors negative requested to 0", () => {
    expect(
      clampAssignmentAmount({ envelopeRemaining: 1000, expenseRemaining: 500, requested: -10 }),
    ).toBe(0);
  });
});

describe("findExistingAssignment", () => {
  const envelope = {
    entry: { id: "inc-1" },
    assignments: [
      { assignment: { id: "a1", assigned_amount: 100, expense_entry_id: "exp-1" } },
      { assignment: { id: "a2", assigned_amount: 50, expense_entry_id: "exp-2" } },
    ],
  } as never;

  it("returns the assignment when one exists for the expense", () => {
    expect(findExistingAssignment(envelope, "exp-1")).toEqual({
      id: "a1",
      assigned_amount: 100,
      expense_entry_id: "exp-1",
    });
  });

  it("returns null when none exists", () => {
    expect(findExistingAssignment(envelope, "exp-999")).toBeNull();
  });
});

describe("computeExpenseRemainder", () => {
  it("returns converted_amount minus sum of assignments", () => {
    expect(
      computeExpenseRemainder({
        converted_amount: 600,
        assignmentsToThisExpense: [100, 200],
      }),
    ).toBe(300);
  });

  it("returns 0 when fully assigned (never negative)", () => {
    expect(
      computeExpenseRemainder({
        converted_amount: 600,
        assignmentsToThisExpense: [400, 300],
      }),
    ).toBe(0);
  });
});

describe("buildJarCapacityPreview", () => {
  it("reports coversFull when envelope can absorb the whole remainder", () => {
    expect(
      buildJarCapacityPreview({
        envelopeRemaining: 1000,
        expenseRemainder: 500,
      }),
    ).toEqual({
      absorbs: 500,
      leftover: 0,
      coversFull: true,
      jarWouldFill: false,
    });
  });

  it("reports partial + jarWouldFill when envelope is the tighter side", () => {
    expect(
      buildJarCapacityPreview({
        envelopeRemaining: 400,
        expenseRemainder: 600,
      }),
    ).toEqual({
      absorbs: 400,
      leftover: 200,
      coversFull: false,
      jarWouldFill: true,
    });
  });

  it("reports absorbs 0 when envelope is full", () => {
    expect(
      buildJarCapacityPreview({ envelopeRemaining: 0, expenseRemainder: 500 }),
    ).toEqual({ absorbs: 0, leftover: 500, coversFull: false, jarWouldFill: false });
  });
});
