import { z } from "zod";
import { uuidStr } from "./shared";

export const destinatarioSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(100),
  default_category_id: uuidStr()
    .optional()
    .nullable()
    .transform((v) => v || null),
  notes: z
    .string()
    .max(500)
    .optional()
    .nullable()
    .transform((v) => v || null),
  is_active: z.boolean().default(true),
});

export const destinatarioRuleSchema = z.object({
  match_type: z.enum(["contains", "exact"]).default("contains"),
  pattern: z
    .string()
    .min(2, "El patrón debe tener al menos 2 caracteres")
    .max(200),
  priority: z.coerce.number().int().min(0).default(100),
});

export type DestinatarioFormData = z.infer<typeof destinatarioSchema>;
export type DestinatarioRuleFormData = z.infer<typeof destinatarioRuleSchema>;
