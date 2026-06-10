import { z } from "zod";
import { uuidStr } from "./shared";

const scenarioLineSchema = z.object({
  categoryId: uuidStr("Categoría inválida"),
  name: z.string().min(1).max(120),
  current: z.number().min(0).nullable(),
  scenario: z.number().min(0).max(10_000_000_000),
  avg3m: z.number().min(0).nullable(),
  isFixed: z.boolean(),
  group: z.enum(["needs", "wants", "savings"]),
});

const startupItemSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(120),
  amount: z.number().min(0).max(10_000_000_000),
  verdict: z.enum(["BUY", "BUY_WITH_CAUTION", "WAIT", "NOT_RECOMMENDED"]).nullable(),
  wishlistItemId: uuidStr("Deseo inválido").nullable(),
  deferred: z.boolean(),
});

export const scenarioDraftSchema = z.object({
  name: z.string().min(1, "Ponle un nombre a la simulación").max(80),
  lines: z.array(scenarioLineSchema).max(120),
  startup: z.object({
    items: z.array(startupItemSchema).max(40),
    monthlyRate: z.number().min(0).max(10_000_000_000),
    useCushion: z.boolean(),
  }),
});

export const saveScenarioSchema = z.object({
  id: uuidStr("Simulación inválida").nullable(),
  draft: scenarioDraftSchema,
});
