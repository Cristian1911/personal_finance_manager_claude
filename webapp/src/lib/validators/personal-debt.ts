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

export const recordRepaymentSchema = z.object({
  amount: z.coerce.number().positive("El abono debe ser mayor a 0"),
  transaction_date: z.string().regex(DATE, "Fecha inválida"),
  account_id: z.string().regex(UUID, "Cuenta inválida"),
  notes: optionalText,
});
