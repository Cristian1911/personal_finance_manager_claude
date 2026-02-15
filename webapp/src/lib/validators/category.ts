import { z } from "zod";

// Permissive UUID pattern — see transaction.ts for rationale
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const categorySchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(50),
  name_es: z.string().optional(),
  slug: z.string().min(1).max(50),
  icon: z.string().default("tag"),
  color: z.string().default("#6b7280"),
  direction: z.enum(["INFLOW", "OUTFLOW"]).optional().nullable(),
  parent_id: z.string().regex(UUID_RE, "UUID inválido").optional().nullable(),
  is_essential: z.boolean().default(false),
});

export type CategoryFormData = z.infer<typeof categorySchema>;
