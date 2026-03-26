import { z } from "zod";
import { uuidStr } from "./shared";

export const budgetSchema = z.object({
    category_id: uuidStr("Categoría inválida"),
    amount: z.number().min(0, "El monto no puede ser negativo"),
    period: z.enum(["monthly", "yearly"]).default("monthly"),
});

export type BudgetFormData = z.infer<typeof budgetSchema>;
