import { z } from "zod";

const widgetConfigSchema = z.object({
  id: z.string(),
  visible: z.boolean(),
  order: z.number().int().min(0),
  section: z.enum(["hero", "niveles", "flujo", "presupuesto", "patrimonio", "actividad", "cuentas"]),
});

const mobileWidgetInstanceSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  size: z.enum(["XS", "S", "M", "L"]),
});

const mobileLayoutSchema = z.object({
  pulseRange: z.enum(["weekly", "monthly"]),
  widgets: z.array(mobileWidgetInstanceSchema).max(20),
});

export const dashboardConfigSchema = z.object({
  purpose: z.enum(["manage_debt", "track_spending", "save_money", "improve_habits"]),
  widgets: z.array(widgetConfigSchema).min(1).max(20),
  mobileLayout: mobileLayoutSchema.optional(),
});

export const mobileDashboardLayoutSchema = mobileLayoutSchema;
