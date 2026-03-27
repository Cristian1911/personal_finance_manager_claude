import { z } from "zod";
import { uuidStr } from "./shared";

const formBoolean = z.preprocess(
  (val) => val === true || val === "true" || val === "on",
  z.boolean().default(false)
);

export const transactionSchema = z.object({
  account_id: uuidStr("Cuenta inválida"),
  amount: z.coerce.number().positive("El monto debe ser mayor a 0"),
  currency_code: z.enum(["COP", "BRL", "MXN", "USD", "EUR", "PEN", "CLP", "ARS"]),
  direction: z.enum(["INFLOW", "OUTFLOW"]),
  transaction_date: z.string().min(1, "La fecha es requerida"),
  raw_description: z.string().optional(),
  merchant_name: z.string().optional(),
  category_id: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    uuidStr().optional().nullable()
  ),
  notes: z.string().optional(),
  capture_input_text: z.string().optional(),
  is_subscription: formBoolean,
  tags: z.array(z.string()).optional(),
});

export type TransactionFormData = z.infer<typeof transactionSchema>;

export const transactionCreateOptionsSchema = z.object({
  create_destinatario: formBoolean,
  destinatario_name: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    z.string().max(100).optional()
  ),
  create_recurring_template: formBoolean,
  recurring_frequency: z
    .enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "QUARTERLY", "ANNUAL"])
    .optional()
    .default("MONTHLY"),
  recurring_start_date: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    z.string().optional()
  ),
  recurring_transfer_source_account_id: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    uuidStr().optional().nullable()
  ),
});

export type TransactionCreateOptions = z.infer<typeof transactionCreateOptionsSchema>;

export const quickCapturePreviewSchema = transactionSchema.extend({
  raw_description: z.string().min(1, "La captura original es requerida"),
  merchant_name: z.string().min(1, "La descripción es requerida"),
  capture_input_text: z.string().min(1, "La frase original es requerida"),
});

export type QuickCapturePreviewFormData = z.infer<typeof quickCapturePreviewSchema>;

export const transactionFiltersSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  accountId: uuidStr().optional(),
  categoryId: uuidStr().optional(),
  direction: z.enum(["INFLOW", "OUTFLOW"]).optional(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  search: z.string().optional(),
  amountMin: z.coerce.number().nonnegative().optional(),
  amountMax: z.coerce.number().nonnegative().optional(),
  showExcluded: z.preprocess(
    (val) => val === "true" || val === true,
    z.boolean().default(false)
  ),
});

export type TransactionFilters = z.infer<typeof transactionFiltersSchema>;
