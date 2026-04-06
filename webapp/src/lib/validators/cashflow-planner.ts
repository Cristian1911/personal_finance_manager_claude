import { z } from "zod";
import { uuidStr } from "./shared";

export const planningPeriodSchema = z.object({
  name: z.string().max(100).optional(),
  preset: z.enum(["WEEKLY", "BIWEEKLY", "MONTHLY", "CUSTOM"]),
  start_date: z.string().min(1, "Fecha de inicio requerida"),
  end_date: z.string().min(1, "Fecha de fin requerida"),
  currency_code: z.string().default("COP"),
  notes: z.string().max(500).optional(),
}).refine(
  (d) => d.end_date >= d.start_date,
  { message: "La fecha de fin debe ser igual o posterior a la de inicio", path: ["end_date"] },
);

export type PlanningPeriodFormData = z.infer<typeof planningPeriodSchema>;

export const planningEntrySchema = z.object({
  period_id: uuidStr("Periodo inválido"),
  entry_type: z.enum(["INCOME", "EXPENSE"]),
  label: z.string().min(1, "El nombre es requerido").max(200),
  amount: z.number().positive("El monto debe ser mayor a cero"),
  currency_code: z.string().default("COP"),
  expected_date: z.string().min(1, "La fecha es requerida"),
  account_id: uuidStr().optional().or(z.literal("")),
  category_id: uuidStr().optional().or(z.literal("")),
  notes: z.string().max(500).optional(),
});

export type PlanningEntryFormData = z.infer<typeof planningEntrySchema>;

export const planningAssignmentSchema = z.object({
  income_entry_id: uuidStr("Ingreso inválido"),
  expense_entry_id: uuidStr("Gasto inválido"),
  assigned_amount: z.number().positive("El monto debe ser mayor a cero"),
});

export type PlanningAssignmentFormData = z.infer<typeof planningAssignmentSchema>;
