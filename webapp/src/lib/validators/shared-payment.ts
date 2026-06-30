import { z } from "zod";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const optionalDate = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().regex(DATE, "Fecha inválida").optional(),
);

const optionalText = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().max(500).optional(),
);

const optionalUuid = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.string().regex(UUID, "ID inválido").optional(),
);

const optionalNumber = z.preprocess(
  (v) => (v === "" || v == null ? undefined : v),
  z.coerce.number().nonnegative("El valor no puede ser negativo").optional(),
);

export const splitParticipantSchema = z.object({
  destinatario_id: z.string().regex(UUID, "Persona inválida"),
  // amount (method="amount") or percent (method="percent"); ignored for "equal"
  value: optionalNumber,
});

export const createSharedPaymentSchema = z
  .object({
    mode: z.enum(["new", "existing"]),
    // existing-mode source:
    origin_transaction_id: optionalUuid,
    // new-mode source:
    account_id: optionalUuid,
    total_amount: z.preprocess(
      (v) => (v === "" || v == null ? undefined : v),
      z.coerce.number().positive("El monto debe ser mayor a 0").optional(),
    ),
    paid_on: optionalDate,
    currency_code: z.string().min(3).max(3).default("COP"),
    description: optionalText,
    method: z.enum(["equal", "amount", "percent"]).default("equal"),
    // Radix/checkbox sends a string; treat anything but "false"/false as true.
    user_included: z.preprocess(
      (v) => !(v === "false" || v === false),
      z.boolean(),
    ),
    due_date: optionalDate,
    participants: z
      .array(splitParticipantSchema)
      .min(1, "Agrega al menos una persona"),
  })
  .refine(
    (d) => d.mode !== "existing" || !!d.origin_transaction_id,
    { message: "Selecciona la transacción a repartir", path: ["origin_transaction_id"] },
  )
  .refine(
    (d) => d.mode !== "new" || !!d.account_id,
    { message: "Selecciona una cuenta", path: ["account_id"] },
  )
  .refine(
    (d) => d.mode !== "new" || (d.total_amount != null && d.total_amount > 0),
    { message: "Ingresa el monto total del pago", path: ["total_amount"] },
  );

export type CreateSharedPaymentInput = z.infer<typeof createSharedPaymentSchema>;
