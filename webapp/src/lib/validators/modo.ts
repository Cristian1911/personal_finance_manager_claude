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
  });

export type ModoInput = z.infer<typeof modoSchema>;

export function parseTagsParam(csv?: string): string[] {
  if (!csv) return [];
  return csv.split(",").map((s) => s.trim()).filter(Boolean);
}
