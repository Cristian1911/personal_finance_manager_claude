import { z } from "zod";
import { UUID_RE, uuidStr } from "./shared";

export const transferSchema = z
  .object({
    fromAccountId: uuidStr("ID inválido"),
    toAccountId: uuidStr("ID inválido"),
    amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
    currencyCode: z.string().min(3).max(3),
    date: z.string().min(1, "La fecha es requerida"),
    notes: z.string().max(500).optional(),
    // Enrichment only — malformed ids are dropped, not a reason to fail.
    tagIds: z.preprocess(
      (val) =>
        Array.isArray(val)
          ? val.filter((v) => typeof v === "string" && UUID_RE.test(v))
          : val,
      z.array(z.string()).default([])
    ),
  })
  .refine((data) => data.fromAccountId !== data.toAccountId, {
    message: "Las cuentas de origen y destino deben ser diferentes",
    path: ["toAccountId"],
  });

export type TransferInput = z.infer<typeof transferSchema>;
