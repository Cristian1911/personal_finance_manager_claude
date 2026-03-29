import { z } from "zod";

export const tagGroupSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(50),
  color: z.string().nullable().optional(),
});

export const tagSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(50),
  group_id: z.string().uuid().nullable().optional(),
});

export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
