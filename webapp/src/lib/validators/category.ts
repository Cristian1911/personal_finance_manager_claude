import { z } from "zod";
import { uuidStr } from "./shared";

export const categorySchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(50),
  name_es: z.string().optional(),
  slug: z.string().min(1).max(50),
  icon: z.string().default("tag"),
  color: z.string().default("#6b7280"),
  direction: z.enum(["INFLOW", "OUTFLOW"]).optional().nullable(),
  parent_id: uuidStr().optional().nullable(),
  is_essential: z.boolean().default(false),
});

export type CategoryFormData = z.infer<typeof categorySchema>;
