import { z } from "zod";
import { supabase } from "../lib/supabase.js";

export const createReviewSchema = {
  title: z.string().describe("Descripción corta del problema"),
  description: z.string().optional().describe("Explicación detallada"),
  severity: z
    .enum(["nit", "bug", "idea", "sketch"])
    .optional()
    .describe("Nivel de severidad (por defecto: idea)"),
  route: z.string().optional().describe("Ruta de la página donde ocurre el problema"),
  component_hint: z
    .string()
    .optional()
    .describe("Nombre del componente si se conoce"),
};

export const createReviewDescription =
  "Crea una revisión de diseño desde Claude Code.";

export async function createReviewHandler(args: {
  title: string;
  description?: string;
  severity?: "nit" | "bug" | "idea" | "sketch";
  route?: string;
  component_hint?: string;
}) {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .limit(1)
    .single();

  const { data, error } = await supabase
    .from("design_reviews")
    .insert({
      user_id: profile?.id,
      title: args.title,
      description: args.description ?? null,
      severity: args.severity ?? "idea",
      route: args.route ?? null,
      component_hint: args.component_hint ?? null,
      device_context: { platform: "claude-code", source: "mcp" },
    })
    .select("id")
    .single();

  if (error) {
    return {
      content: [{ type: "text" as const, text: `Error: ${error.message}` }],
    };
  }

  return {
    content: [
      {
        type: "text" as const,
        text: `Revisión creada: ${data.id.slice(0, 8)} — "${args.title}"`,
      },
    ],
  };
}
