import { describe, expect, it } from "vitest";
import { modoSchema, parseTagsParam } from "@/lib/validators/modo";

describe("modoSchema", () => {
  const base = {
    name: "Cartagena",
    date_from: "2026-07-01",
    date_to: "2026-07-05",
    tag_ids: ["00000000-0000-0000-0000-0000000000a1"],
  };

  it("acepta un modo válido", () => {
    expect(modoSchema.safeParse(base).success).toBe(true);
  });

  it("rechaza nombre vacío", () => {
    expect(modoSchema.safeParse({ ...base, name: "" }).success).toBe(false);
  });

  it("rechaza date_to anterior a date_from", () => {
    const r = modoSchema.safeParse({ ...base, date_from: "2026-07-05", date_to: "2026-07-01" });
    expect(r.success).toBe(false);
  });

  it("acepta tag_ids vacío", () => {
    expect(modoSchema.safeParse({ ...base, tag_ids: [] }).success).toBe(true);
  });

  it("acepta un modo compartido con participantes", () => {
    const r = modoSchema.safeParse({
      ...base,
      is_shared: true,
      split_method: "equal",
      user_included: true,
      participants: [{ destinatario_id: "11111111-1111-1111-1111-111111111111" }],
    });
    expect(r.success).toBe(true);
  });

  it("rechaza modo compartido sin participantes", () => {
    const r = modoSchema.safeParse({ ...base, is_shared: true, participants: [] });
    expect(r.success).toBe(false);
  });

  it("modo no compartido no exige participantes (default false)", () => {
    const r = modoSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.is_shared).toBe(false);
  });
});

describe("parseTagsParam", () => {
  it("parsea CSV a array", () => {
    expect(parseTagsParam("a,b,c")).toEqual(["a", "b", "c"]);
  });
  it("devuelve [] para undefined o vacío", () => {
    expect(parseTagsParam(undefined)).toEqual([]);
    expect(parseTagsParam("")).toEqual([]);
  });
  it("descarta segmentos vacíos", () => {
    expect(parseTagsParam("a,,b,")).toEqual(["a", "b"]);
  });
});
