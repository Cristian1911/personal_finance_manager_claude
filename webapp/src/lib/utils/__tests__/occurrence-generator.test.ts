import { describe, expect, it } from "vitest";
import {
  computeStaleOccurrenceIds,
  generateOccurrenceRows,
  type OccurrenceRow,
} from "@/lib/utils/occurrence-generator";

const quincenalTemplate = {
  id: "tpl-1",
  user_id: "user-1",
  amount: 2_500_000,
  start_date: "2026-07-15",
  frequency: "BIWEEKLY" as const,
  end_date: null,
  is_active: true,
};

// Rango del generador para julio 2026: mes completo + 14 días.
const julyStart = new Date(2026, 6, 1);
const julyEndPlus14 = new Date(2026, 7, 14);

describe("generateOccurrenceRows — quincenal anclada al mes", () => {
  it("genera 15 y 30 (nunca 29) para una quincena que inicia el 15", () => {
    const rows = generateOccurrenceRows(quincenalTemplate, julyStart, julyEndPlus14);
    // Serie anclada: {15, 30} de cada mes. La siguiente (Aug 15) queda fuera
    // del rango (que termina Aug 14) — con saltos de 14 días habría caído
    // erróneamente en Jul 29 y Aug 12.
    expect(rows.map((r) => r.occurrence_date)).toEqual([
      "2026-07-15",
      "2026-07-30",
    ]);
  });
});

describe("computeStaleOccurrenceIds", () => {
  const expected: OccurrenceRow[] = generateOccurrenceRows(
    quincenalTemplate,
    julyStart,
    julyEndPlus14,
  );

  it("marca como stale la fecha drifteada (Jul 29) que el schedule ya no produce", () => {
    const existing = [
      { id: "occ-15", template_id: "tpl-1", occurrence_date: "2026-07-15" },
      { id: "occ-29", template_id: "tpl-1", occurrence_date: "2026-07-29" },
      { id: "occ-30", template_id: "tpl-1", occurrence_date: "2026-07-30" },
    ];
    expect(computeStaleOccurrenceIds(expected, existing)).toEqual(["occ-29"]);
  });

  it("no marca nada cuando todas las fechas coinciden con el schedule", () => {
    const existing = [
      { id: "occ-15", template_id: "tpl-1", occurrence_date: "2026-07-15" },
      { id: "occ-30", template_id: "tpl-1", occurrence_date: "2026-07-30" },
    ];
    expect(computeStaleOccurrenceIds(expected, existing)).toEqual([]);
  });

  it("marca todas las filas de una plantilla sin fechas esperadas (ended/editada)", () => {
    const existing = [
      { id: "occ-a", template_id: "tpl-ended", occurrence_date: "2026-07-10" },
      { id: "occ-b", template_id: "tpl-ended", occurrence_date: "2026-07-24" },
    ];
    expect(computeStaleOccurrenceIds([], existing)).toEqual(["occ-a", "occ-b"]);
  });

  it("aísla por plantilla — la fecha de otra plantilla no cuenta como válida", () => {
    const existing = [
      // tpl-2 tiene una fila en una fecha que SÍ es válida para tpl-1
      { id: "occ-x", template_id: "tpl-2", occurrence_date: "2026-07-15" },
    ];
    expect(computeStaleOccurrenceIds(expected, existing)).toEqual(["occ-x"]);
  });
});
