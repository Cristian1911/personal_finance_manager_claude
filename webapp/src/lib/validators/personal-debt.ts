import { z } from "zod";
import { splitParticipantSchema } from "./shared-payment";

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

export const personalDebtIdSchema = z.string().regex(UUID, "ID inválido");

export const createPersonalDebtSchema = z.object({
  destinatario_id: z.string().regex(UUID, "Persona inválida"),
  direction: z.enum(["borrowed", "lent"]),
  principal_amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  currency_code: z.string().min(3).max(3).default("COP"),
  opened_on: z.string().regex(DATE, "Fecha de apertura inválida"),
  due_date: optionalDate,
  notes: optionalText,
  origin_transaction_id: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.string().regex(UUID).optional(),
  ),
});

export const updatePersonalDebtSchema = z.object({
  principal_amount: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().positive().optional(),
  ),
  due_date: optionalDate,
  notes: optionalText,
});

/**
 * "Dividir entre varias personas": turn ONE existing `lent` debt into N sibling
 * debts sharing a split_group_id. There is no `user_included` flag — the debt's
 * principal is by definition what OTHERS owe, so the user never takes a share
 * of it (contrast with a fresh Pago compartido, which splits a payment total).
 */
export const splitPersonalDebtSchema = z.object({
  method: z.enum(["equal", "amount", "percent"]).default("equal"),
  participants: z
    .array(splitParticipantSchema)
    .min(2, "Divide entre al menos dos personas")
    .max(50, "Son demasiadas personas para un solo reparto"),
});

export const recordRepaymentSchema = z.object({
  amount: z.coerce.number().positive("El abono debe ser mayor a 0"),
  transaction_date: z.string().regex(DATE, "Fecha inválida"),
  account_id: z.string().regex(UUID, "Cuenta inválida"),
  notes: optionalText,
});
