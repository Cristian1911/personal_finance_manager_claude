import { z } from "zod";
import { uuidStr } from "./shared";

const CURRENCY_CODES = ["COP", "BRL", "MXN", "USD", "EUR", "PEN", "CLP", "ARS"] as const;

export const subPaymentSchema = z.object({
  currency_code: z.enum(CURRENCY_CODES),
  amount: z.coerce.number().positive("El monto de cada moneda debe ser mayor a 0"),
});

export const recurringTemplateSchema = z.object({
  account_id: uuidStr("Cuenta inválida"),
  transfer_source_account_id: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    uuidStr().optional().nullable()
  ),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  currency_code: z.enum(CURRENCY_CODES),
  direction: z.enum(["INFLOW", "OUTFLOW"]),
  frequency: z.enum(["ONCE", "WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"]),
  merchant_name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
  category_id: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    uuidStr().optional().nullable()
  ),
  destinatario_id: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    uuidStr().optional().nullable()
  ),
  day_of_month: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    z.coerce.number().int().min(1).max(31).optional().nullable()
  ),
  day_of_week: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    z.coerce.number().int().min(0).max(6).optional().nullable()
  ),
  start_date: z.string().min(1, "La fecha de inicio es requerida"),
  end_date: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    z.string().optional().nullable()
  ),
  sub_payments: z.preprocess(
    (val) => {
      if (val === "" || val === null || val === undefined) return undefined;
      if (typeof val === "string") {
        try { return JSON.parse(val); } catch { return undefined; }
      }
      return val;
    },
    z.array(subPaymentSchema).optional().nullable()
  ),
});

export type RecurringTemplateFormData = z.infer<typeof recurringTemplateSchema>;
