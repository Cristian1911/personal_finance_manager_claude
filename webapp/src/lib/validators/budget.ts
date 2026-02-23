import { z } from "zod";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const budgetSchema = z.object({
    category_id: z.string().regex(UUID_RE, "Categoría inválida"),
    amount: z.number().min(0, "El monto no puede ser negativo"),
    period: z.enum(["monthly", "yearly"]).default("monthly"),
});

export type BudgetFormData = z.infer<typeof budgetSchema>;
