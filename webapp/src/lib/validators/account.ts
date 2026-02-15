import { z } from "zod";

export const accountSchema = z.object({
  name: z.string().min(1, "El nombre es requerido").max(100),
  account_type: z.enum([
    "CHECKING",
    "SAVINGS",
    "CREDIT_CARD",
    "CASH",
    "INVESTMENT",
    "LOAN",
    "OTHER",
  ]),
  institution_name: z.string().optional(),
  current_balance: z.coerce.number(),
  currency_code: z.enum(["COP", "BRL", "MXN", "USD", "EUR", "PEN", "CLP", "ARS"]).default("COP"),
  credit_limit: z.coerce.number().min(0).optional().nullable(),
  interest_rate: z.coerce.number().min(0).max(100).optional().nullable(),
  cutoff_day: z.coerce.number().min(1).max(31).optional().nullable(),
  payment_day: z.coerce.number().min(1).max(31).optional().nullable(),
  loan_amount: z.coerce.number().min(0).optional().nullable(),
  monthly_payment: z.coerce.number().min(0).optional().nullable(),
  loan_start_date: z.string().optional().nullable(),
  loan_end_date: z.string().optional().nullable(),
  initial_investment: z.coerce.number().min(0).optional().nullable(),
  expected_return_rate: z.coerce.number().min(0).max(100).optional().nullable(),
  maturity_date: z.string().optional().nullable(),
  color: z.string().optional(),
  icon: z.string().optional(),
  mask: z.string().max(4).optional(),
});

export type AccountFormData = z.infer<typeof accountSchema>;

// Specialized schemas for each account type
export const creditCardSchema = accountSchema.extend({
  account_type: z.literal("CREDIT_CARD"),
  credit_limit: z.coerce.number().min(0, "El límite debe ser mayor a 0"),
  cutoff_day: z.coerce.number().min(1).max(31).optional().nullable(),
  payment_day: z.coerce.number().min(1).max(31).optional().nullable(),
  interest_rate: z.coerce.number().min(0).max(100).optional().nullable(),
});

export const loanSchema = accountSchema.extend({
  account_type: z.literal("LOAN"),
  loan_amount: z.coerce.number().min(0),
  monthly_payment: z.coerce.number().min(0).optional().nullable(),
  interest_rate: z.coerce.number().min(0).max(100).optional().nullable(),
  loan_start_date: z.string().optional().nullable(),
  loan_end_date: z.string().optional().nullable(),
});

export const investmentSchema = accountSchema.extend({
  account_type: z.literal("INVESTMENT"),
  initial_investment: z.coerce.number().min(0).optional().nullable(),
  expected_return_rate: z.coerce.number().min(0).max(100).optional().nullable(),
  maturity_date: z.string().optional().nullable(),
});

type CreditCardFormData = z.infer<typeof creditCardSchema>;
type LoanFormData = z.infer<typeof loanSchema>;
type InvestmentFormData = z.infer<typeof investmentSchema>;
