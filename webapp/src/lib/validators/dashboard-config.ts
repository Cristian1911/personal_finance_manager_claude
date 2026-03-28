import { z } from "zod";

const widgetConfigSchema = z.object({
  id: z.string(),
  visible: z.boolean(),
  order: z.number().int().min(0),
  section: z.enum(["hero", "niveles", "flujo", "presupuesto", "patrimonio", "actividad", "cuentas"]),
});

export const dashboardConfigSchema = z.object({
  purpose: z.enum(["manage_debt", "track_spending", "save_money", "improve_habits"]),
  widgets: z.array(widgetConfigSchema).min(1).max(20),
});
