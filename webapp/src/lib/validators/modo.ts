import { z } from "zod";
import { uuidStr } from "./shared";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida");

export const modoSchema = z
  .object({
    name: z.string().trim().min(1, "El nombre es obligatorio").max(80),
    color: z.string().max(32).optional().nullable(),
    emoji: z.string().max(8).optional().nullable(),
    date_from: dateStr,
    date_to: dateStr,
    tag_ids: z.array(uuidStr("Etiqueta inválida")).default([]),
    is_shared: z.boolean().default(false),
    split_method: z.enum(["equal", "percent"]).default("equal"),
    user_included: z.boolean().default(true),
    participants: z
      .array(
        z.object({
          destinatario_id: uuidStr("Persona inválida"),
          value: z.coerce.number().nonnegative().optional(),
        }),
      )
      .default([]),
  })
  .refine((d) => d.date_from <= d.date_to, {
    message: "La fecha final no puede ser anterior a la inicial",
    path: ["date_to"],
  })
  .refine((d) => !d.is_shared || d.participants.length >= 1, {
    message: "Agrega al menos una persona para compartir",
    path: ["participants"],
  })
  // Percent: falla rápido al guardar (si no, computeSplit rechaza cada tx en el
  // reparto con un toast genérico). Regla espejo de computeSplit: los valores son
  // el % de las OTRAS personas — si te incluyes tomas el resto (Σ ≤ 100), si no
  // deben sumar 100. Todos los participantes deben tener % definido.
  .refine(
    (d) => {
      if (!d.is_shared || d.split_method !== "percent") return true;
      if (d.participants.some((p) => p.value == null)) return false;
      const sum = d.participants.reduce((s, p) => s + (p.value ?? 0), 0);
      return d.user_included ? sum <= 100 + 1e-6 : Math.abs(sum - 100) < 1e-6;
    },
    {
      message: "Los porcentajes deben sumar 100% (o menos si te incluyes en el reparto)",
      path: ["participants"],
    },
  );

export type ModoInput = z.infer<typeof modoSchema>;

export function parseTagsParam(csv?: string): string[] {
  if (!csv) return [];
  return csv.split(",").map((s) => s.trim()).filter(Boolean);
}
