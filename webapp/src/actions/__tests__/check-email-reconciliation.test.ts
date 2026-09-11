import { describe, expect, it, vi, beforeEach } from "vitest";

const { getAuthenticatedClient, findEmailDuplicateCandidate, findTransactionByIdempotencyKey } =
  vi.hoisted(() => ({
    getAuthenticatedClient: vi.fn(),
    findEmailDuplicateCandidate: vi.fn(),
    findTransactionByIdempotencyKey: vi.fn(),
  }));

vi.mock("@/lib/supabase/auth", () => ({ getAuthenticatedClient }));
vi.mock("@/lib/supabase/cached", () => ({ createCachedClient: vi.fn() }));
vi.mock("@/lib/cache/revalidation", () => ({ revalidateFinancialViews: vi.fn() }));
vi.mock("@/lib/email-ingest/duplicate-check", () => ({
  findEmailDuplicateCandidate,
  findTransactionByIdempotencyKey,
}));
vi.mock("./../destinatarios", () => ({ matchTransactionToDestinatario: vi.fn() }));
vi.mock("@/actions/occurrences", () => ({ linkTransactionToOccurrence: vi.fn() }));
vi.mock("next/cache", () => ({
  updateTag: vi.fn(), revalidateTag: vi.fn(), cacheTag: vi.fn(), cacheLife: vi.fn(),
  unstable_cacheTag: vi.fn(), unstable_cacheLife: vi.fn(),
}));

import { approveEmailTransaction, checkEmailReconciliation } from "@/actions/email-ingest";

const USER = { id: "user-1" };
const PARSED = {
  amount: 45000,
  direction: "OUTFLOW",
  transaction_date: "2026-09-10",
  transaction_time: "13:05",
  raw_line: "Compraste $45.000 en EXITO",
  merchant: "EXITO",
  pattern_type: "purchase",
};

function pendingRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "pending-1",
    user_id: USER.id,
    status: "pending",
    suggested_account_id: "acc-1",
    idempotency_key: "key-1",
    parsed_data: PARSED,
    ...overrides,
  };
}

/** Only `pending_email_transactions` is read by the check; anything else throws. */
function makeClient(row: Record<string, unknown> | null) {
  return {
    from(table: string) {
      if (table !== "pending_email_transactions") {
        throw new Error(`unexpected table ${table}`);
      }
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              maybeSingle: () => Promise.resolve({ data: row, error: null }),
            }),
          }),
        }),
      };
    },
  };
}

const candidate = {
  id: "tx-existing",
  raw_description: "EXITO",
  merchant_name: "EXITO",
  transaction_date: "2026-09-10",
  amount: 45000,
  direction: "OUTFLOW",
  category_id: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("checkEmailReconciliation", () => {
  it("ofrece el candidato difuso como posible duplicado a revisar", async () => {
    getAuthenticatedClient.mockResolvedValue({ supabase: makeClient(pendingRow()), user: USER });
    findTransactionByIdempotencyKey.mockResolvedValue(null);
    findEmailDuplicateCandidate.mockResolvedValue({
      candidate,
      match: { score: 0.82, decision: "REVIEW" },
    });

    const result = await checkEmailReconciliation("pending-1");

    expect(result).toEqual({
      success: true,
      data: {
        kind: "review",
        decision: "REVIEW",
        candidate: { ...candidate, score: 0.82 },
      },
    });
  });

  it("reporta la fila como ya procesada cuando dejó de estar pendiente", async () => {
    getAuthenticatedClient.mockResolvedValue({
      supabase: makeClient(pendingRow({ status: "imported" })),
      user: USER,
    });

    const result = await checkEmailReconciliation("pending-1");

    expect(result).toEqual({ success: true, data: { kind: "processed", status: "imported" } });
    expect(findEmailDuplicateCandidate).not.toHaveBeenCalled();
  });

  it("distingue una fila descartada de una importada", async () => {
    getAuthenticatedClient.mockResolvedValue({
      supabase: makeClient(pendingRow({ status: "dismissed" })),
      user: USER,
    });

    const result = await checkEmailReconciliation("pending-1");

    expect(result).toEqual({ success: true, data: { kind: "processed", status: "dismissed" } });
  });

  it("no pregunta cuando la propia alerta ya aterrizó (importación en carrera)", async () => {
    // The first import already inserted the transaction with the row's own
    // idempotency key; a second check must not offer that row's import as a
    // "posible duplicado" — approve retires the row as a certain duplicate.
    getAuthenticatedClient.mockResolvedValue({ supabase: makeClient(pendingRow()), user: USER });
    findTransactionByIdempotencyKey.mockResolvedValue("tx-self");
    findEmailDuplicateCandidate.mockResolvedValue({
      candidate: { ...candidate, id: "tx-self" },
      match: { score: 1, decision: "AUTO_MERGE" },
    });

    const result = await checkEmailReconciliation("pending-1");

    expect(result).toEqual({ success: true, data: null });
    expect(findTransactionByIdempotencyKey).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER.id, idempotencyKey: "key-1" }),
    );
    expect(findEmailDuplicateCandidate).not.toHaveBeenCalled();
  });

  it("sigue al chequeo difuso cuando la fila no tiene clave de idempotencia", async () => {
    getAuthenticatedClient.mockResolvedValue({
      supabase: makeClient(pendingRow({ idempotency_key: null })),
      user: USER,
    });
    findEmailDuplicateCandidate.mockResolvedValue(null);

    const result = await checkEmailReconciliation("pending-1");

    expect(result).toEqual({ success: true, data: null });
    expect(findTransactionByIdempotencyKey).not.toHaveBeenCalled();
    expect(findEmailDuplicateCandidate).toHaveBeenCalledTimes(1);
  });
});

describe("approveEmailTransaction", () => {
  it("rechaza con un mensaje claro una fila que ya se importó", async () => {
    getAuthenticatedClient.mockResolvedValue({
      supabase: makeClient(pendingRow({ status: "imported" })),
      user: USER,
    });

    const result = await approveEmailTransaction("pending-1");

    expect(result).toEqual({ success: false, error: "Esta transacción ya se había importado." });
  });

  it("rechaza con un mensaje claro una fila descartada", async () => {
    getAuthenticatedClient.mockResolvedValue({
      supabase: makeClient(pendingRow({ status: "dismissed" })),
      user: USER,
    });

    const result = await approveEmailTransaction("pending-1");

    expect(result).toEqual({ success: false, error: "Esta transacción ya se había descartado." });
  });
});
