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
