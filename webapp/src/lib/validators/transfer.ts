import { z } from "zod";

export const transferSchema = z
  .object({
    fromAccountId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "ID inválido"),
    toAccountId: z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "ID inválido"),
    amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
    currencyCode: z.string().min(3).max(3),
    date: z.string().min(1, "La fecha es requerida"),
    notes: z.string().max(500).optional(),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: "Las cuentas de origen y destino deben ser diferentes",
    path: ["toAccountId"],
  });

export type TransferInput = z.infer<typeof transferSchema>;
