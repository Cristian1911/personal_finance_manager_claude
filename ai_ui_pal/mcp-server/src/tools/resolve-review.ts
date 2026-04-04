import { z } from "zod";
import { supabase } from "../lib/supabase.js";

export const resolveReviewSchema = {
  review_id: z
    .string()
    .describe("UUID de la revisión de diseño a resolver"),
  notes: z
    .string()
    .optional()
    .describe("Qué se cambió para resolver esta revisión"),
};

export const resolveReviewDescription =
  "Marca una revisión de diseño como resuelta después de corregir el problema.";

export async function resolveReviewHandler(args: {
  review_id: string;
  notes?: string;
}) {
  const updateData: Record<string, unknown> = {
    status: "resolved",
    resolved_by: "claude",
    resolved_at: new Date().toISOString(),
  };

  if (args.notes) {
    updateData.description = `[Claude resolution] ${args.notes}`;
  }

  const { error } = await supabase
    .from("design_reviews")
    .update(updateData)
    .eq("id", args.review_id);

  if (error) {
    return {
      content: [{ type: "text" as const, text: `Error: ${error.message}` }],
    };
  }

  return {
    content: [
      {
        type: "text" as const,
        text: `Revisión ${args.review_id.slice(0, 8)} marcada como resuelta.`,
      },
    ],
  };
}
