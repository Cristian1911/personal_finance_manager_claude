import { z } from "zod";
import { uuidStr } from "./shared";

// Quick capture — minimum fields
export const createWishlistItemSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(200, "Máximo 200 caracteres"),
  amount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().positive("El monto debe ser positivo")
  ),
  currency_code: z.string().default("COP"),
});

// Enrichment — context fields
export const enrichWishlistItemSchema = z.object({
  id: uuidStr("ID inválido"),
  why: z.string().max(500).optional(),
  urgency: z.enum(["NECESSARY", "USEFUL", "IMPULSE"]),
  desire_type: z.enum(["long_held", "recent", "spontaneous"]),
  category_id: uuidStr("Categoría inválida").nullable().optional(),
  funding_type: z.enum(["ONE_TIME", "INSTALLMENTS"]),
  installments: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : Number(v)),
    z.number().int().min(2).max(36).nullable()
  ),
  account_id: uuidStr("Cuenta inválida").nullable().optional(),
});

// Post-purchase reflection
export const reflectionSchema = z.object({
  wishlist_item_id: uuidStr("ID inválido"),
  reflection_stage: z.enum(["14_day", "60_day"]),
  worth_it: z.boolean(),
  rating: z.coerce.number().int().min(1).max(5),
  note: z.string().max(500).optional(),
});

export type CreateWishlistItemInput = z.infer<typeof createWishlistItemSchema>;
export type EnrichWishlistItemInput = z.infer<typeof enrichWishlistItemSchema>;
export type ReflectionInput = z.infer<typeof reflectionSchema>;
