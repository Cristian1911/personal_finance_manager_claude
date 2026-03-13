import { z } from "zod";

const currencyEnum = z.enum(["COP", "BRL", "MXN", "USD", "EUR", "PEN", "CLP", "ARS"]);

export const cashEntrySchema = z.object({
  id: z.string().regex(/^[0-9a-f]{8}-/i),
  amount: z.number().positive(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  label: z.string().optional(),
  currency: currencyEnum,
  recurring: z.object({ months: z.number().int().positive() }).optional(),
});

export const scenarioAllocationsSchema = z.object({
  manualOverrides: z.array(z.object({
    month: z.string(),
    cashEntryId: z.string(),
    accountId: z.string(),
    amount: z.number().positive(),
  })).default([]),
  cascadeRedirects: z.array(z.object({
    fromAccountId: z.string(),
    toAccountId: z.string(),
  })).default([]),
  customPriority: z.array(z.string()).optional(),
});

const snapshotAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(["CREDIT_CARD", "LOAN"]),
  balance: z.number(),
  currency: currencyEnum,
  interestRate: z.number().nullable(),
  monthlyPayment: z.number().nullable(),
  creditLimit: z.number().nullable(),
  paymentDay: z.number().nullable(),
  cutoffDay: z.number().nullable(),
  color: z.string().nullable(),
  institutionName: z.string().nullable(),
  currencyBreakdown: z.any().nullable(),
});

const scenarioResultSchema = z.object({
  totalMonths: z.number(),
  totalInterestPaid: z.number(),
  totalAmountPaid: z.number(),
  debtFreeDate: z.string(),
  payoffOrder: z.array(z.any()),
  timeline: z.array(z.any()),
});

export const saveScenarioSchema = z.object({
  id: z.string().regex(/^[0-9a-f]{8}-/i).optional(),
  name: z.string().min(1).max(100).optional(),
  cashEntries: z.array(cashEntrySchema).min(1),
  strategy: z.enum(["snowball", "avalanche", "custom"]),
  allocations: scenarioAllocationsSchema,
  snapshotAccounts: z.array(snapshotAccountSchema).min(1),
  results: scenarioResultSchema,
});

export type SaveScenarioInput = z.infer<typeof saveScenarioSchema>;
