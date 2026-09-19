import { z } from "zod";
import { uuidStr } from "./shared";

export const importShareConfigSchema = z.object({
  method: z.enum(["equal", "percent"]),
  userIncluded: z.boolean(),
  participants: z
    .array(
      z.object({
        destinatario_id: uuidStr("Persona inválida"),
        value: z.number().min(0).max(100).optional(),
      })
    )
    .min(1, "Elige al menos una persona")
    .max(12, "Máximo 12 personas")
    .refine(
      (ps) => new Set(ps.map((p) => p.destinatario_id)).size === ps.length,
      "No repitas a la misma persona"
    ),
  ea_rate_percent: z.number().min(0).max(200).optional().nullable(),
});

export const transactionToImportSchema = z.object({
  import_key: z.string().optional(),
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
  categorization_source: z.enum(["SYSTEM_DEFAULT", "USER_CREATED", "ML_MODEL", "USER_OVERRIDE", "USER_LEARNED"]).optional(),
  categorization_confidence: z.number().min(0).max(1).optional().nullable(),
  installment_current: z.number().int().positive().optional().nullable(),
  installment_total: z.number().int().positive().optional().nullable(),
  installment_group_id: z.string().optional().nullable(),
  original_amount: z.number().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  destinatario_id: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    uuidStr().optional().nullable()
  ),
  merchant_name: z.string().optional().nullable(),
  tag_ids: z.array(uuidStr("Etiqueta inválida")).max(20).optional(),
  modo_id: z.preprocess(
    (val) => (val === "" || val === null ? undefined : val),
    uuidStr("Viaje inválido").optional().nullable()
  ),
  share: importShareConfigSchema.optional().nullable(),
});

export const reconciliationDecisionSchema = z.object({
  statementIndex: z.number().int().min(0),
  transactionIndex: z.number().int().min(0),
  candidateTransactionId: uuidStr("Transacción candidata inválida"),
  decision: z.enum(["AUTO_MERGE", "MERGE", "KEEP_BOTH"]),
  score: z.number().min(0).max(1),
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

const investmentMetadataSchema = z.object({
  fund_name: z.string().nullable(),
  investment_account_number: z.string().nullable(),
  unit_value_end: z.number().nullable(),
  period_return_pct: z.number().nullable(),
  fee_pct_annual: z.number().nullable(),
  previous_balance: z.number().nullable(),
  additions: z.number().nullable(),
  withdrawals: z.number().nullable(),
  net_returns: z.number().nullable(),
  withholding: z.number().nullable(),
  new_balance: z.number().nullable(),
  units_end: z.number().nullable(),
  maturity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha de vencimiento inválida").nullable(),
});

const statementMetaSchema = z.object({
  accountId: uuidStr("Cuenta inválida"),
  statementIndex: z.number().int().min(0),
  summary: statementSummarySchema.nullable(),
  creditCardMetadata: creditCardMetadataSchema.nullable(),
  loanMetadata: loanMetadataSchema.nullable().optional(),
  investmentMetadata: investmentMetadataSchema.nullable().optional(),
  periodFrom: z.string().nullable(),
  periodTo: z.string().nullable(),
  currency: z.string(),
  sourceFilename: z.string().optional(),
  transactionCount: z.number().int().min(0),
  primaryCurrency: z.string().optional(),
});

export const importPayloadSchema = z.object({
  transactions: z.array(transactionToImportSchema),
  statementMeta: z.array(statementMetaSchema).optional(),
  reconciliationDecisions: z.array(reconciliationDecisionSchema).optional(),
  // Source of the import. Defaults to PDF_IMPORT (manual upload); the wizard
  // sets EMAIL_PDF_IMPORT when seeded from a pending email statement.
  captureMethod: z.enum(["PDF_IMPORT", "EMAIL_PDF_IMPORT", "OCR_SINGLE", "OCR_BATCH"]).optional(),
});
