import { z } from "zod";

export const reminderSchema = z.object({
  title: z.string().min(1, "El titulo es requerido").max(200),
  amount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : Number(v)),
    z.number().positive("El monto debe ser positivo").optional()
  ),
  currency_code: z.string().default("COP"),
  due_date: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : String(v)),
    z.string().optional()
  ),
});

export type ReminderInput = z.infer<typeof reminderSchema>;
