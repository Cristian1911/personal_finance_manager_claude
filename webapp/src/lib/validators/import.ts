import { z } from "zod";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidStr = (msg = "UUID inválido") => z.string().regex(UUID_RE, msg);

export const transactionToImportSchema = z.object({
  account_id: uuidStr("Cuenta inválida"),
  amount: z.number().positive("El monto debe ser mayor a 0"),
  currency_code: z.enum(["COP", "BRL", "MXN", "USD", "EUR", "PEN", "CLP", "ARS"]),
  direction: z.enum(["INFLOW", "OUTFLOW"]),
  transaction_date: z.string().min(1, "La fecha es requerida"),
  raw_description: z.string().min(1, "La descripción es requerida"),
  category_id: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    uuidStr().optional().nullable()
  ),
  categorization_source: z.enum(["SYSTEM_DEFAULT", "USER_CREATED", "USER_OVERRIDE"]).optional(),
  categorization_confidence: z.number().min(0).max(1).optional().nullable(),
});

const statementSummarySchema = z.object({
  previous_balance: z.number().nullable(),
  total_credits: z.number().nullable(),
  total_debits: z.number().nullable(),
  final_balance: z.number().nullable(),
  purchases_and_charges: z.number().nullable(),
  interest_charged: z.number().nullable(),
});

const creditCardMetadataSchema = z.object({
  credit_limit: z.number().nullable(),
  available_credit: z.number().nullable(),
  interest_rate: z.number().nullable(),
  late_interest_rate: z.number().nullable(),
  total_payment_due: z.number().nullable(),
  minimum_payment: z.number().nullable(),
  payment_due_date: z.string().nullable(),
});

const loanMetadataSchema = z.object({
  loan_number: z.string().nullable(),
  loan_type: z.string().nullable(),
  initial_amount: z.number().nullable(),
  disbursement_date: z.string().nullable(),
  remaining_balance: z.number().nullable(),
  interest_rate: z.number().nullable(),
  late_interest_rate: z.number().nullable(),
  total_payment_due: z.number().nullable(),
  minimum_payment: z.number().nullable(),
  payment_due_date: z.string().nullable(),
  installments_in_default: z.number().nullable(),
  statement_cut_date: z.string().nullable(),
  last_payment_date: z.string().nullable(),
});

const statementMetaSchema = z.object({
  accountId: uuidStr("Cuenta inválida"),
  statementIndex: z.number().int().min(0),
  summary: statementSummarySchema.nullable(),
  creditCardMetadata: creditCardMetadataSchema.nullable(),
  loanMetadata: loanMetadataSchema.nullable().optional(),
  periodFrom: z.string().nullable(),
  periodTo: z.string().nullable(),
  currency: z.string(),
  sourceFilename: z.string().optional(),
  transactionCount: z.number().int().min(0),
});

export const importPayloadSchema = z.object({
  transactions: z.array(transactionToImportSchema),
  statementMeta: z.array(statementMetaSchema).optional(),
});
