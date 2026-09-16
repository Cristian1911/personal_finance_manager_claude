import { describe, expect, it } from "vitest";
import {
  classifyModoCandidate,
  compareModoCandidates,
  type ModoCandidateTx,
} from "../modo-candidates";

const range = { date_from: "2026-08-10", date_to: "2026-08-20", tag_ids: ["trip"] };
const base: ModoCandidateTx = {
  id: "t",
  direction: "OUTFLOW",
  transaction_date: "2026-08-12",
  capture_method: "MANUAL_FORM",
  flow_class: "SPEND",
  currency_code: "COP",
};

describe("classifyModoCandidate", () => {
  it("auto-etiqueta capturas manuales en rango", () => {
    expect(classifyModoCandidate(base, range)).toEqual({
      verdict: "auto",
      reason: "manual_capture",
      foreignCurrency: false,
    });
    expect(classifyModoCandidate({ ...base, capture_method: "TEXT_QUICK_CAPTURE" }, range).verdict).toBe("auto");
  });

  it("manda importados (tier 1/2) a la bandeja", () => {
    expect(classifyModoCandidate({ ...base, capture_method: "PDF_IMPORT" }, range)).toMatchObject({ verdict: "suggest", reason: "imported" });
    expect(classifyModoCandidate({ ...base, capture_method: "EMAIL_IMPORT" }, range).verdict).toBe("suggest");
    expect(classifyModoCandidate({ ...base, capture_method: "OCR_SINGLE" }, range).verdict).toBe("suggest");
  });

  it("nunca propone movimientos que no son gasto del viaje", () => {
    const cases: Array<[Partial<ModoCandidateTx>, string]> = [
      [{ transfer_group_id: "x" }, "transfer"],
      [{ personal_debt_id: "x" }, "person"],
      [{ is_excluded: true }, "excluded"],
      [{ installment_group_id: "x" }, "installment"],
      [{ is_recurring: true }, "recurring"],
      [{ is_subscription: true }, "recurring"],
      [{ recurrence_group_id: "x" }, "recurring"],
      [{ linkedToOccurrence: true }, "recurring"],
      [{ direction: "INFLOW" }, "inflow"],
      [{ flow_class: "SELF_TRANSFER" }, "not_spend"],
      [{ flow_class: "DEBT_PAYMENT" }, "not_spend"],
      [{ transaction_date: "2026-08-09" }, "out_of_range"],
      [{ transaction_date: "2026-08-21" }, "out_of_range"],
      [{ tag_ids: ["trip", "other"] }, "already_tagged"],
      [{ reviewed: true }, "already_reviewed"],
    ];
    for (const [patch, reason] of cases) {
      const r = classifyModoCandidate({ ...base, ...patch }, range);
      expect(r.verdict, reason).toBe("skip");
      expect(r.reason).toBe(reason);
    }
  });

  it("filas sin clasificar (null / UNCLASSIFIED) siguen contando como gasto", () => {
    expect(classifyModoCandidate({ ...base, flow_class: null }, range).verdict).toBe("auto");
    expect(classifyModoCandidate({ ...base, flow_class: "UNCLASSIFIED" }, range).verdict).toBe("auto");
    expect(classifyModoCandidate({ ...base, flow_class: "CASH_WITHDRAWAL" }, range).verdict).toBe("auto");
  });

  it("marca moneda extranjera solo cuando hay moneda base", () => {
    expect(classifyModoCandidate({ ...base, currency_code: "ARS" }, range).foreignCurrency).toBe(false);
    expect(classifyModoCandidate({ ...base, currency_code: "ARS" }, range, { homeCurrency: "COP" }).foreignCurrency).toBe(true);
    expect(classifyModoCandidate(base, range, { homeCurrency: "COP" }).foreignCurrency).toBe(false);
  });

  it("los tag_ids del rango son opcionales", () => {
    expect(classifyModoCandidate({ ...base, tag_ids: ["trip"] }, { date_from: range.date_from, date_to: range.date_to }).verdict).toBe("auto");
  });
});

describe("compareModoCandidates", () => {
  it("ordena moneda extranjera, luego retiros, luego más reciente", () => {
    const mk = (fx: boolean, flow: string, date: string) => ({
      candidate: { verdict: "suggest" as const, reason: "imported" as const, foreignCurrency: fx },
      tx: { flow_class: flow, transaction_date: date },
    });
    const rows = [
      mk(false, "SPEND", "2026-08-15"),
      mk(true, "SPEND", "2026-08-11"),
      mk(false, "CASH_WITHDRAWAL", "2026-08-12"),
      mk(false, "SPEND", "2026-08-18"),
    ];
    const sorted = [...rows].sort(compareModoCandidates);
    expect(sorted.map((r) => r.tx.transaction_date)).toEqual([
      "2026-08-11",
      "2026-08-12",
      "2026-08-18",
      "2026-08-15",
    ]);
  });
});
