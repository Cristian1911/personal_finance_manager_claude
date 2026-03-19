import { z } from "zod";

const tabConfigSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string(),
  features: z.array(z.string()),
  position: z.union([z.literal(2), z.literal(3)]),
});

const widgetConfigSchema = z.object({
  id: z.string(),
  visible: z.boolean(),
  order: z.number().int().min(0),
  section: z.enum(["hero", "niveles", "flujo", "presupuesto", "patrimonio", "actividad"]),
});

export const dashboardConfigSchema = z.object({
  purpose: z.enum(["manage_debt", "track_spending", "save_money", "improve_habits"]),
  tabs: z.array(tabConfigSchema).min(1).max(3),
  widgets: z.array(widgetConfigSchema).min(1).max(20),
});
