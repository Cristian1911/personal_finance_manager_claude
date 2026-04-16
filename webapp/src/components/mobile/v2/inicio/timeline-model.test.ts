import { describe, it, expect } from "vitest";
import { buildTimelineItems, type TimelineSources } from "./timeline-model";

const emptySources: TimelineSources = {
  overdueReminders: [],
  upcomingPayments: [],
  pendingEmails: [],
  upcomingIncome: [],
  todayStr: "2026-04-16",
};

describe("buildTimelineItems", () => {
  it("returns empty array when all sources are empty", () => {
    expect(buildTimelineItems(emptySources)).toEqual([]);
  });

  it("marks overdue items as urgency=overdue with Vencido label", () => {
    const items = buildTimelineItems({
      ...emptySources,
      overdueReminders: [
        {
          id: "r1",
          title: "Pago luz",
          due_date: "2026-04-10",
          amount: 100000,
          currency_code: "COP",
        },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0].urgency).toBe("overdue");
    expect(items[0].kind).toBe("reminder");
    expect(items[0].dateLabel).toContain("Vencido");
  });

  it("collapses multiple pending emails into a single today card", () => {
    const items = buildTimelineItems({
      ...emptySources,
      pendingEmails: [
        {
          id: "e1",
          merchant: "B",
          amount: 10000,
          direction: "OUTFLOW",
          date: "2026-04-16",
          card_last4: "1234",
          suggested_account_id: null,
        },
        {
          id: "e2",
          merchant: "B",
          amount: 20000,
          direction: "OUTFLOW",
          date: "2026-04-16",
          card_last4: "1234",
          suggested_account_id: null,
        },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0].urgency).toBe("today");
    expect(items[0].kind).toBe("emails");
    expect(items[0].title).toContain("2");
  });

  it("sorts by date ascending: overdue → today → future", () => {
    const items = buildTimelineItems({
      ...emptySources,
      overdueReminders: [
        {
          id: "r1",
          title: "Luz",
          due_date: "2026-04-12",
          amount: 50000,
          currency_code: "COP",
        },
      ],
      upcomingPayments: [
        {
          templateId: "t1",
          occurrenceDate: "2026-04-20",
          next_date: "2026-04-20",
          amount: 200000,
          name: "Renta",
          direction: "OUTFLOW",
        },
        {
          templateId: "t2",
          occurrenceDate: "2026-04-16",
          next_date: "2026-04-16",
          amount: 30000,
          name: "EPM",
          direction: "OUTFLOW",
        },
      ],
    });
    expect(items.map((i) => i.urgency)).toEqual(["overdue", "today", "future"]);
  });

  it("marks upcoming income as kind=income with isIncome=true", () => {
    const items = buildTimelineItems({
      ...emptySources,
      upcomingIncome: [
        { occurrenceDate: "2026-04-27", amount: 1200000, name: "Nómina UPB" },
      ],
    });
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe("income");
    expect(items[0].urgency).toBe("future");
    expect(items[0].isIncome).toBe(true);
    expect(items[0].subtitle.startsWith("+")).toBe(true);
  });
});
