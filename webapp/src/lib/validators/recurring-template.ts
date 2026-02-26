import { z } from "zod";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidStr = (msg = "UUID inválido") => z.string().regex(UUID_RE, msg);

export const recurringTemplateSchema = z.object({
  account_id: uuidStr("Cuenta inválida"),
  transfer_source_account_id: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    uuidStr().optional().nullable()
  ),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  currency_code: z.enum(["COP", "BRL", "MXN", "USD", "EUR", "PEN", "CLP", "ARS"]),
  direction: z.enum(["INFLOW", "OUTFLOW"]),
  frequency: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"]),
  merchant_name: z.string().min(1, "El nombre es requerido"),
  description: z.string().optional(),
  category_id: z.preprocess(
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
});

export type RecurringTemplateFormData = z.infer<typeof recurringTemplateSchema>;
