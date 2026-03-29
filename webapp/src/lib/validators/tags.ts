import { z } from "zod";

export { generateSlug } from "@/lib/utils/string";

export const tagGroupSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(50),
  color: z.string().nullable().optional(),
});

export const tagSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(50),
  group_id: z.string().uuid().nullable().optional(),
});
