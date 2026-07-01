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
  })
  .refine((d) => d.date_from <= d.date_to, {
    message: "La fecha final no puede ser anterior a la inicial",
    path: ["date_to"],
  });

export type ModoInput = z.infer<typeof modoSchema>;

export function parseTagsParam(csv?: string): string[] {
  if (!csv) return [];
  return csv.split(",").map((s) => s.trim()).filter(Boolean);
}
