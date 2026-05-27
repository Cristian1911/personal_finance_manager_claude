import { describe, it, expect } from "vitest";
import { detectSubscriptions, type DetectorTransaction } from "../subscription-detector";

const tx = (
  destinatario_id: string | null,
  date: string,
  amount: number,
): DetectorTransaction => ({
  destinatario_id,
  transaction_date: date,
  amount,
  currency_code: "COP",
  direction: "OUTFLOW",
});

describe("detectSubscriptions", () => {
  it("detects a stable monthly charge as a candidate", () => {
    const txs = [
      tx("d1", "2026-03-05", 16900),
      tx("d1", "2026-04-05", 16900),
      tx("d1", "2026-05-05", 17900),
    ];
    const result = detectSubscriptions(txs, new Set());
    expect(result).toHaveLength(1);
    expect(result[0].destinatario_id).toBe("d1");
    expect(result[0].occurrence_count).toBe(3);
    expect(result[0].median_amount).toBe(16900);
  });

  it("ignores groups with fewer than 3 charges", () => {
    const txs = [tx("d1", "2026-04-05", 16900), tx("d1", "2026-05-05", 16900)];
    expect(detectSubscriptions(txs, new Set())).toHaveLength(0);
  });

  it("ignores non-monthly cadence", () => {
    const txs = [
      tx("d1", "2026-01-05", 16900),
      tx("d1", "2026-03-05", 16900),
      tx("d1", "2026-05-05", 16900),
    ];
    expect(detectSubscriptions(txs, new Set())).toHaveLength(0);
  });

  it("ignores unstable amounts", () => {
    const txs = [
      tx("d1", "2026-03-05", 10000),
      tx("d1", "2026-04-05", 50000),
      tx("d1", "2026-05-05", 90000),
    ];
    expect(detectSubscriptions(txs, new Set())).toHaveLength(0);
  });

  it("excludes destinatarios that already have a subscription", () => {
    const txs = [
      tx("d1", "2026-03-05", 16900),
      tx("d1", "2026-04-05", 16900),
      tx("d1", "2026-05-05", 16900),
    ];
    expect(detectSubscriptions(txs, new Set(["d1"]))).toHaveLength(0);
  });

  it("ignores transactions with no destinatario and INFLOWs", () => {
    const txs: DetectorTransaction[] = [
      tx(null, "2026-03-05", 16900),
      tx(null, "2026-04-05", 16900),
      tx(null, "2026-05-05", 16900),
      {
        destinatario_id: "d2",
        transaction_date: "2026-03-05",
        amount: 16900,
        currency_code: "COP",
        direction: "INFLOW",
      },
    ];
    expect(detectSubscriptions(txs, new Set())).toHaveLength(0);
  });
});
