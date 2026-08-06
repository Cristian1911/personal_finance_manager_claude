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

/**
 * A typed-in participant name. Whitespace-normalized here so the value the
 * resolver dedupes on is the same one the user sees ("  Juan  Pérez " and
 * "Juan Pérez" must resolve to a single ad-hoc destinatario).
 */
export const optionalPersonName = z.preprocess(
  (v) => {
    if (typeof v !== "string") return undefined;
    const trimmed = v.trim().replace(/\s+/g, " ");
    return trimmed === "" ? undefined : trimmed;
  },
  z.string().max(80, "El nombre es muy largo").optional(),
);

/**
 * A participant is EITHER an existing contact (`destinatario_id`) OR an ad-hoc
 * person the user just typed a name for (`name`) — never both, never neither.
 * Ad-hoc names are materialized into hidden `is_ad_hoc` destinatarios by
 * `resolveSplitParticipants()` before anything is persisted, because
 * `personal_debts.destinatario_id` is NOT NULL.
 */
export const splitParticipantSchema = z
  .object({
    destinatario_id: optionalUuid,
    name: optionalPersonName,
    // amount (method="amount") or percent (method="percent"); ignored for "equal"
    value: optionalNumber,
  })
  .refine((p) => !!p.destinatario_id !== !!p.name, {
    message: "Cada persona necesita un contacto o un nombre",
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
