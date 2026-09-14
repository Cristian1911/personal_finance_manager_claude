import { describe, it, expect } from "vitest";
import {
  findReconciliationCandidates,
  scoreReconciliationCandidate,
  type ReconciliationCandidate,
} from "../reconciliation";

function makeCandidate(
  overrides: Partial<ReconciliationCandidate> = {}
): ReconciliationCandidate {
  return {
    id: "cand-1",
    user_id: "user-1",
    account_id: "acc-1",
    amount: 30000,
    direction: "OUTFLOW",
    transaction_date: "2026-07-05",
    raw_description: null,
    ...overrides,
  };
}

const TRANSFER_30K = {
  account_id: "acc-1",
  amount: 30000,
  direction: "OUTFLOW" as const,
  transaction_date: "2026-07-05",
  raw_description:
    "Transferiste $30,000 desde tu cuenta *4398 a la cuenta *3046422834 el 05/07/2026 a las 18:51",
};

describe("scoreReconciliationCandidate — conflicting reference entities", () => {
  it("does NOT match two same-day transfers to different destination accounts", () => {
    // Bug repro (2026-07-06): $30.000 → *3046422834 flagged as duplicate of
    // $31.000 → *55124544245. Template boilerplate dominated token similarity;
    // the differing destination account must break the match.
    const candidate = makeCandidate({
      amount: 31000,
      raw_description:
        "Transferiste $31,000 desde tu cuenta *4398 a la cuenta *55124544245 el 05/07/2026 a las 02:43",
      merchant_name: "55124544245",
      clean_description: "55124544245",
    });

    const result = findReconciliationCandidates(TRANSFER_30K, [candidate]);
    expect(
      !result.bestMatch || result.bestMatch.decision === "NO_MATCH"
    ).toBe(true);
  });

  it("still matches the same transfer captured twice (same destination ref)", () => {
    const candidate = makeCandidate({
      raw_description:
        "Transferiste $30,000 desde tu cuenta *4398 a la cuenta *3046422834 el 05/07/2026 a las 18:51",
    });

    const match = scoreReconciliationCandidate(TRANSFER_30K, candidate);
    expect(match).not.toBeNull();
    expect(match!.decision).toBe("AUTO_MERGE");
  });

  it("keeps matching one-sided refs (terse PDF row vs verbose email)", () => {
    // PDF side has no ≥6-digit run, so the ref-conflict guard must not fire.
    const importTx = {
      account_id: "acc-1",
      amount: 180865,
      direction: "OUTFLOW" as const,
      transaction_date: "2026-07-05",
      raw_description:
        "Compraste COP180.865 en AMAZON.COM con tu T.Cred *1234 el 05/07/2026 a las 10:00. Ref 987654321",
    };
    const candidate = makeCandidate({
      amount: 180865,
      raw_description: "AMAZON.COM",
      merchant_name: "AMAZON.COM",
    });

    const match = scoreReconciliationCandidate(importTx, candidate);
    expect(match).not.toBeNull();
    expect(match!.decision).not.toBe("NO_MATCH");
  });

  it("does not fire on cross-source true duplicates with different ref kinds", () => {
    // PDF savings row carries a batch/authorization number; the email for the
    // SAME transfer carries the destination account. Different number kinds
    // never overlap, but text similarity is low (no shared template), so the
    // ref-conflict guard must NOT fire — this pair must stay visible as a
    // possible duplicate exactly like before the guard existed.
    const pdfImport = {
      account_id: "acc-1",
      amount: 30000,
      direction: "OUTFLOW" as const,
      transaction_date: "2026-07-05",
      raw_description: "TRANSFERENCIA CTA SUC VIRTUAL REF 99887766",
    };
    const emailCandidate = makeCandidate({
      raw_description:
        "Transferiste $30,000 desde tu cuenta *4398 a la cuenta *3046422834 el 05/07/2026 a las 18:51",
    });

    const match = scoreReconciliationCandidate(pdfImport, emailCandidate);
    expect(match).not.toBeNull();
    expect(match!.decision).toBe("REVIEW");
  });

  it("demotes exact-amount pairs with conflicting refs to REVIEW instead of AUTO_MERGE", () => {
    // Same template + same amount but different destination: still plausible
    // enough to ask the user, never silent-merge.
    const candidate = makeCandidate({
      raw_description:
        "Transferiste $30,000 desde tu cuenta *4398 a la cuenta *55124544245 el 05/07/2026 a las 02:43",
    });

    const match = scoreReconciliationCandidate(TRANSFER_30K, candidate);
    expect(match).not.toBeNull();
    expect(match!.decision).toBe("REVIEW");
  });
});

describe("scoreReconciliationCandidate — hard filters", () => {
  it("rejects different accounts, directions, >5% amounts and >3 days", () => {
    expect(
      scoreReconciliationCandidate(TRANSFER_30K, makeCandidate({ account_id: "acc-2" }))
    ).toBeNull();
    expect(
      scoreReconciliationCandidate(TRANSFER_30K, makeCandidate({ direction: "INFLOW" }))
    ).toBeNull();
    expect(
      scoreReconciliationCandidate(TRANSFER_30K, makeCandidate({ amount: 32000 }))
    ).toBeNull();
    expect(
      scoreReconciliationCandidate(
        TRANSFER_30K,
        makeCandidate({ transaction_date: "2026-07-10" })
      )
    ).toBeNull();
    expect(
      scoreReconciliationCandidate(
        TRANSFER_30K,
        makeCandidate({ reconciled_into_transaction_id: "tx-x" })
      )
    ).toBeNull();
  });
});

describe("scoreReconciliationCandidate — structured evidence from bank alerts (#391)", () => {
  const RETIRO_20K = {
    account_id: "acc-1",
    amount: 20000,
    direction: "OUTFLOW" as const,
    transaction_date: "2026-08-21",
    transaction_time: "11:25",
    source_pattern: "retiro",
    capture_method: "EMAIL_IMPORT" as const,
    raw_description:
      "Bancolombia: Retiraste $20.000 en CAJERO CENTRO con tu tarjeta *1234 el 21/08/2026 a las 11:25",
  };
  const compraCandidate = makeCandidate({
    amount: 20000,
    transaction_date: "2026-08-18",
    transaction_time: "15:02:00",
    source_pattern: "compra_debito",
    capture_method: "EMAIL_IMPORT",
    raw_description:
      "Bancolombia: Compraste $20.000 en TIENDA D1 con tu tarjeta *1234 el 18/08/2026 a las 15:02",
  });

  it("never pairs alert families of different kinds (retiro vs compra)", () => {
    expect(scoreReconciliationCandidate(RETIRO_20K, compraCandidate)).toBeNull();
    // Same kind on the same day still scores.
    expect(
      scoreReconciliationCandidate(
        RETIRO_20K,
        makeCandidate({
          ...compraCandidate,
          transaction_date: "2026-08-21",
          transaction_time: "11:25:00",
          source_pattern: "retiro",
        })
      )
    ).not.toBeNull();
  });

  it("requires the same day and time when both rows came from emails", () => {
    const sameFamilyOtherDay = makeCandidate({
      ...compraCandidate,
      source_pattern: "retiro",
    });
    expect(scoreReconciliationCandidate(RETIRO_20K, sameFamilyOtherDay)).toBeNull();

    const sameDayOtherTime = makeCandidate({
      ...sameFamilyOtherDay,
      transaction_date: "2026-08-21",
      transaction_time: "18:40:00",
    });
    expect(scoreReconciliationCandidate(RETIRO_20K, sameDayOtherTime)).toBeNull();

    const sameDayNearTime = makeCandidate({
      ...sameFamilyOtherDay,
      transaction_date: "2026-08-21",
      transaction_time: "11:26:00",
    });
    expect(scoreReconciliationCandidate(RETIRO_20K, sameDayNearTime)?.decision).not.toBe(
      "NO_MATCH"
    );
  });

  it("keeps the ±3 day window for manual or bank-verified candidates", () => {
    const manual = makeCandidate({
      amount: 20000,
      transaction_date: "2026-08-19",
      capture_method: "MANUAL_FORM",
      raw_description: "retiro cajero",
    });
    expect(scoreReconciliationCandidate(RETIRO_20K, manual)).not.toBeNull();

    const pdfRow = makeCandidate({
      amount: 20000,
      transaction_date: "2026-08-22",
      capture_method: "PDF_IMPORT",
      raw_description: "RETIRO CAJERO CENTRO",
    });
    expect(scoreReconciliationCandidate(RETIRO_20K, pdfRow)).not.toBeNull();
  });
});

describe("scoreReconciliationCandidate — user-entered near-match REVIEW floor", () => {
  // Real pair from the June-2026 savings statement: the user pre-typed a loan
  // prepayment with an estimated amount; the bank settled a slightly lower
  // figure with a generic description. Zero token overlap → score 0.60.
  const PDF_LOAN_PAYMENT = {
    account_id: "acc-1",
    amount: 1_607_046,
    direction: "OUTFLOW" as const,
    transaction_date: "2026-06-16",
    raw_description: "PAGO CREDITO SUC VIRTUAL",
    capture_method: "PDF_IMPORT" as const,
  };

  const manualCandidate = (overrides: Record<string, unknown> = {}) => ({
    id: "cand-1",
    user_id: "u1",
    account_id: "acc-1",
    amount: 1_651_641,
    direction: "OUTFLOW" as const,
    transaction_date: "2026-06-17",
    raw_description: "Transferencia a Bancolombia Préstamo ****8386 - Pago extra",
    merchant_name: "Transferencia a Bancolombia Préstamo ****8386",
    clean_description: null,
    reconciled_into_transaction_id: null,
    capture_method: "MANUAL_FORM" as const,
    ...overrides,
  });

  it("floors a tier-3 candidate near a bank-verified import to REVIEW", () => {
    const match = scoreReconciliationCandidate(PDF_LOAN_PAYMENT, manualCandidate());
    expect(match).not.toBeNull();
    expect(match!.score).toBeLessThan(0.75); // the floor is decision-only
    expect(match!.decision).toBe("REVIEW");
  });

  it("does not floor tier-2 (email) candidates", () => {
    const match = scoreReconciliationCandidate(
      PDF_LOAN_PAYMENT,
      manualCandidate({ capture_method: "EMAIL_IMPORT" })
    );
    expect(match!.decision).toBe("NO_MATCH");
  });

  it("does not floor when the import side is not bank-verified", () => {
    const match = scoreReconciliationCandidate(
      { ...PDF_LOAN_PAYMENT, capture_method: "EMAIL_IMPORT" },
      manualCandidate()
    );
    expect(match!.decision).toBe("NO_MATCH");
  });

  it("does not floor when capture methods are missing", () => {
    const match = scoreReconciliationCandidate(
      { ...PDF_LOAN_PAYMENT, capture_method: undefined },
      manualCandidate({ capture_method: null })
    );
    expect(match!.decision).toBe("NO_MATCH");
  });

  it("requires amount within 3% and date within 1 day", () => {
    // 4.6% off → outside the floor band (still within the 5% hard filter)
    const farAmount = scoreReconciliationCandidate(
      PDF_LOAN_PAYMENT,
      manualCandidate({ amount: 1_682_000 })
    );
    expect(farAmount!.decision).toBe("NO_MATCH");

    const farDate = scoreReconciliationCandidate(
      PDF_LOAN_PAYMENT,
      manualCandidate({ transaction_date: "2026-06-18" })
    );
    expect(farDate!.decision).toBe("NO_MATCH");
  });

  it("never upgrades to AUTO_MERGE via the floor", () => {
    // Exact amount + same day + zero text still lands at REVIEW (0.75), and
    // the floor never pushes anything to AUTO_MERGE on its own.
    const match = scoreReconciliationCandidate(
      PDF_LOAN_PAYMENT,
      manualCandidate({ amount: 1_607_046, transaction_date: "2026-06-16" })
    );
    expect(match!.decision).toBe("REVIEW");
  });
});

describe("findReconciliationCandidates — floored REVIEW must not be shadowed", () => {
  it("prefers an actionable floored candidate over a higher-scoring NO_MATCH", () => {
    const importTx = {
      account_id: "acc-1",
      amount: 1_607_046,
      direction: "OUTFLOW" as const,
      transaction_date: "2026-06-16",
      raw_description: "PAGO CREDITO SUC VIRTUAL",
      capture_method: "PDF_IMPORT" as const,
    };
    const flooredDuplicate = {
      id: "manual-dup",
      user_id: "u1",
      account_id: "acc-1",
      amount: 1_651_641, // 2.8% off → floor band, score 0.60
      direction: "OUTFLOW" as const,
      transaction_date: "2026-06-17",
      raw_description: "Transferencia a Bancolombia Préstamo ****8386 - Pago extra",
      reconciled_into_transaction_id: null,
      capture_method: "MANUAL_FORM" as const,
    };
    const unrelatedHigherScore = {
      id: "email-other",
      user_id: "u1",
      account_id: "acc-1",
      amount: 1_635_000, // ~1.7% off → +0.05 amount points, score 0.65, NO_MATCH
      direction: "OUTFLOW" as const,
      transaction_date: "2026-06-17",
      raw_description: "Pago servicios varios",
      reconciled_into_transaction_id: null,
      capture_method: "EMAIL_IMPORT" as const,
    };

    const result = findReconciliationCandidates(importTx, [
      unrelatedHigherScore,
      flooredDuplicate,
    ]);
    expect(result.bestMatch).not.toBeNull();
    expect(result.bestMatch!.candidateId).toBe("manual-dup");
    expect(result.bestMatch!.decision).toBe("REVIEW");
  });
});
