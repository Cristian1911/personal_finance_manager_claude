import { describe, expect, it, vi, beforeEach } from "vitest";

const { getAuthenticatedClient } = vi.hoisted(() => ({
  getAuthenticatedClient: vi.fn(),
}));
const { ensureCurrentOccurrences, linkTransactionToOccurrence } = vi.hoisted(() => ({
  ensureCurrentOccurrences: vi.fn(),
  linkTransactionToOccurrence: vi.fn(),
}));
const { revalidateFinancialViews } = vi.hoisted(() => ({
  revalidateFinancialViews: vi.fn(),
}));

vi.mock("@/lib/supabase/auth", () => ({ getAuthenticatedClient }));
vi.mock("@/lib/supabase/cached", () => ({
  createCachedClient: vi.fn(),
}));
vi.mock("@/lib/cache/revalidation", () => ({ revalidateFinancialViews }));
vi.mock("@/actions/occurrences", () => ({
  ensureCurrentOccurrences,
  linkTransactionToOccurrence,
}));
vi.mock("next/cache", () => ({
  updateTag: vi.fn(),
  revalidateTag: vi.fn(),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  unstable_cacheTag: vi.fn(),
  unstable_cacheLife: vi.fn(),
}));

import { createRecurringTemplateFromTransaction } from "@/actions/recurring-templates";

const USER = { id: "user-1" };
const VALID_ACCT = "00000000-0000-0000-0000-0000000000a1";
const VALID_CARD = "00000000-0000-0000-0000-0000000000c1";
const VALID_SRC = "00000000-0000-0000-0000-0000000000b1";
const VALID_TX = "00000000-0000-0000-0000-0000000000d1";

function buildFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const defaults: Record<string, string> = {
    account_id: VALID_ACCT,
    amount: "50000",
    currency_code: "COP",
    direction: "OUTFLOW",
    frequency: "MONTHLY",
    merchant_name: "Netflix",
    start_date: "2026-04-17",
    day_of_month: "17",
  };
  for (const [k, v] of Object.entries({ ...defaults, ...overrides })) fd.set(k, v);
  return fd;
}

type TxRow = {
  id: string;
  account_id: string;
  amount: number;
  direction: string;
  transaction_date: string;
};

function buildSupabase({
  tx,
  existingLink,
  account,
  insertedTemplate,
  insertError,
}: {
  tx: TxRow | null;
  existingLink?: { id: string } | null;
  account?: { id: string; account_type: string } | null;
  insertedTemplate?: Record<string, unknown>;
  insertError?: { message: string };
}) {
  const tables: Record<string, unknown> = {
    transactions: {
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: tx, error: null }),
          }),
        }),
      }),
    },
    recurring_occurrences: {
      select: () => ({
        eq: () => ({
          eq: () => ({
            limit: () => ({
              maybeSingle: () => Promise.resolve({ data: existingLink ?? null, error: null }),
            }),
          }),
        }),
      }),
    },
    accounts: {
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve({ data: account ?? null, error: null }),
          }),
        }),
      }),
    },
    recurring_transaction_templates: {
      insert: () => ({
        select: () => ({
          single: () =>
            Promise.resolve({
              data: insertedTemplate ?? { id: "tpl-1" },
              error: insertError ?? null,
            }),
        }),
      }),
    },
  };
  return { from: (t: string) => tables[t] };
}

describe("createRecurringTemplateFromTransaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("happy path: inserts template and links source tx to occurrence", async () => {
    const tx: TxRow = {
      id: VALID_TX,
      account_id: VALID_ACCT,
      amount: 50000,
      direction: "OUTFLOW",
      transaction_date: "2026-04-17",
    };
    getAuthenticatedClient.mockResolvedValue({
      user: USER,
      supabase: buildSupabase({
        tx,
        existingLink: null,
        account: { id: VALID_ACCT, account_type: "BANK" },
      }),
    });

    const result = await createRecurringTemplateFromTransaction(
      VALID_TX,
      { success: false, error: "" },
      buildFormData(),
    );

    expect(result.success).toBe(true);
    expect(ensureCurrentOccurrences).toHaveBeenCalledOnce();
    expect(linkTransactionToOccurrence).toHaveBeenCalledWith(
      VALID_ACCT,
      "2026-04-17",
      50000,
      "OUTFLOW",
      VALID_TX,
    );
    expect(revalidateFinancialViews).toHaveBeenCalledOnce();
  });

  it("rejects when the source transaction is already linked to an occurrence", async () => {
    const tx: TxRow = {
      id: VALID_TX,
      account_id: VALID_ACCT,
      amount: 50000,
      direction: "OUTFLOW",
      transaction_date: "2026-04-17",
    };
    getAuthenticatedClient.mockResolvedValue({
      user: USER,
      supabase: buildSupabase({ tx, existingLink: { id: "occ-existing" } }),
    });

    const result = await createRecurringTemplateFromTransaction(
      VALID_TX,
      { success: false, error: "" },
      buildFormData(),
    );

    expect(result).toEqual({
      success: false,
      error: "Esta transacción ya está vinculada a una recurrente.",
    });
    expect(linkTransactionToOccurrence).not.toHaveBeenCalled();
  });

  it("rejects debt-account creation without transfer_source_account_id", async () => {
    const tx: TxRow = {
      id: VALID_TX,
      account_id: VALID_CARD,
      amount: 50000,
      direction: "INFLOW",
      transaction_date: "2026-04-17",
    };
    getAuthenticatedClient.mockResolvedValue({
      user: USER,
      supabase: buildSupabase({
        tx,
        existingLink: null,
        account: { id: VALID_CARD, account_type: "CREDIT_CARD" },
      }),
    });

    const result = await createRecurringTemplateFromTransaction(
      VALID_TX,
      { success: false, error: "" },
      buildFormData({ account_id: VALID_CARD, direction: "INFLOW" }),
    );

    expect(result).toEqual({
      success: false,
      error: "Selecciona la cuenta origen para el pago de deuda.",
    });
    expect(linkTransactionToOccurrence).not.toHaveBeenCalled();
  });

  it("rejects when the source transaction is missing", async () => {
    getAuthenticatedClient.mockResolvedValue({
      user: USER,
      supabase: buildSupabase({ tx: null }),
    });

    const result = await createRecurringTemplateFromTransaction(
      VALID_TX,
      { success: false, error: "" },
      buildFormData(),
    );

    expect(result).toEqual({
      success: false,
      error: "Transacción no encontrada",
    });
    expect(linkTransactionToOccurrence).not.toHaveBeenCalled();
  });

  it("debt-account happy path with transfer_source_account_id succeeds", async () => {
    const tx: TxRow = {
      id: VALID_TX,
      account_id: VALID_CARD,
      amount: 200000,
      direction: "INFLOW",
      transaction_date: "2026-04-17",
    };
    getAuthenticatedClient.mockResolvedValue({
      user: USER,
      supabase: buildSupabase({
        tx,
        existingLink: null,
        account: { id: VALID_CARD, account_type: "CREDIT_CARD" },
      }),
    });

    const result = await createRecurringTemplateFromTransaction(
      VALID_TX,
      { success: false, error: "" },
      buildFormData({
        account_id: VALID_CARD,
        direction: "INFLOW",
        amount: "200000",
        transfer_source_account_id: VALID_SRC,
      }),
    );

    expect(result.success).toBe(true);
    expect(linkTransactionToOccurrence).toHaveBeenCalledWith(
      VALID_CARD,
      "2026-04-17",
      200000,
      "INFLOW",
      VALID_TX,
    );
  });
});
