import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const attachTagsToTransactions = vi.hoisted(() => vi.fn());
vi.mock("@/lib/tags/attach-transaction-tags", () => ({ attachTagsToTransactions }));

import { applyActiveModoTag, type ActiveModoTagTx } from "@/lib/modos/active-modo-tag";

const USER = "user-1";
const MODO = { id: "modo-1", auto_tag_id: "tag-trip", date_from: "2026-08-10", date_to: "2026-08-20", tag_ids: ["tag-trip"] };

/** Chainable PostgREST mock: `.from(table)` resolves to the row configured for it. */
function makeSupabase(rows: { modo?: typeof MODO | null; occurrence?: { id: string } | null }) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const chain = (result: unknown) => {
    const self: Record<string, unknown> = {};
    for (const m of ["select", "eq", "neq", "limit", "in"]) self[m] = vi.fn(() => self);
    self.maybeSingle = vi.fn(() => Promise.resolve({ data: result, error: null }));
    return self;
  };
  const from = vi.fn((table: string) => {
    if (table === "modos") return chain(rows.modo ?? null);
    if (table === "recurring_occurrences") return chain(rows.occurrence ?? null);
    if (table === "modo_tx_reviews") return { upsert };
    throw new Error(`unexpected table ${table}`);
  });
  return { client: { from } as unknown as SupabaseClient<Database>, upsert, from };
}

const tx: ActiveModoTagTx = {
  id: "tx-1",
  transaction_date: "2026-08-12",
  direction: "OUTFLOW",
  capture_method: "TEXT_QUICK_CAPTURE",
  flow_class: "SPEND",
};

beforeEach(() => {
  attachTagsToTransactions.mockReset();
  attachTagsToTransactions.mockResolvedValue({ attached: 1, error: null });
});

describe("applyActiveModoTag", () => {
  it("etiqueta una captura manual en rango y guarda la revisión 'auto'", async () => {
    const { client, upsert } = makeSupabase({ modo: MODO });
    const res = await applyActiveModoTag(client, USER, tx);
    expect(res).toEqual({ tagged: true, modoId: "modo-1", tagId: "tag-trip" });
    expect(attachTagsToTransactions).toHaveBeenCalledWith(client, USER, ["tx-1"], ["tag-trip"]);
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ modo_id: "modo-1", transaction_id: "tx-1", decision: "included", source: "auto" }),
      expect.objectContaining({ onConflict: "modo_id,transaction_id", ignoreDuplicates: true }),
    );
  });

  it("no hace nada sin viaje activo", async () => {
    const { client, from } = makeSupabase({ modo: null });
    const res = await applyActiveModoTag(client, USER, tx);
    expect(res).toEqual({ tagged: false, reason: "no_active_modo" });
    expect(attachTagsToTransactions).not.toHaveBeenCalled();
    // early exit: no occurrence lookup either
    expect(from).not.toHaveBeenCalledWith("recurring_occurrences");
  });

  it("sale antes de consultar ocurrencias cuando la fecha está fuera del rango", async () => {
    const { client, from } = makeSupabase({ modo: MODO });
    const res = await applyActiveModoTag(client, USER, { ...tx, transaction_date: "2026-09-01" });
    expect(res).toEqual({ tagged: false, reason: "out_of_range" });
    expect(from).not.toHaveBeenCalledWith("recurring_occurrences");
  });

  it("no etiqueta un pago enlazado a una ocurrencia recurrente", async () => {
    const { client } = makeSupabase({ modo: MODO, occurrence: { id: "occ-1" } });
    const res = await applyActiveModoTag(client, USER, tx);
    expect(res).toEqual({ tagged: false, reason: "recurring" });
    expect(attachTagsToTransactions).not.toHaveBeenCalled();
  });

  it("no etiqueta transferencias ni movimientos que no son gasto", async () => {
    const { client } = makeSupabase({ modo: MODO });
    expect(await applyActiveModoTag(client, USER, { ...tx, transfer_group_id: "tg" })).toEqual({ tagged: false, reason: "transfer" });
    expect(await applyActiveModoTag(client, USER, { ...tx, flow_class: "DEBT_PAYMENT" })).toEqual({ tagged: false, reason: "not_spend" });
    expect(await applyActiveModoTag(client, USER, { ...tx, direction: "INFLOW" })).toEqual({ tagged: false, reason: "inflow" });
    expect(attachTagsToTransactions).not.toHaveBeenCalled();
  });

  it("nunca lanza: un fallo del cliente se reporta como no etiquetado", async () => {
    const client = { from: () => { throw new Error("boom"); } } as unknown as SupabaseClient<Database>;
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await applyActiveModoTag(client, USER, tx)).toEqual({ tagged: false, reason: "error" });
    spy.mockRestore();
  });
});
