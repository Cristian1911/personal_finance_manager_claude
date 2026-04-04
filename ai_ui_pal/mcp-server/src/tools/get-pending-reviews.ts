import { z } from "zod";
import { syncReviews } from "../lib/sync.js";

export const getPendingReviewsSchema = {
  include_resolved: z
    .boolean()
    .optional()
    .describe("También incluir revisiones resueltas (por defecto: false)"),
};

export const getPendingReviewsDescription =
  "Obtiene todas las revisiones de diseño abiertas e in_progress desde Supabase. Descarga imágenes de anotaciones a archivos locales y retorna un índice estructurado.";

export async function getPendingReviewsHandler(args: {
  include_resolved?: boolean;
}) {
  const statuses = args.include_resolved
    ? ["open", "in_progress", "resolved"]
    : ["open", "in_progress"];

  const entries = await syncReviews(statuses);

  if (entries.length === 0) {
    return {
      content: [
        { type: "text" as const, text: "No hay revisiones pendientes." },
      ],
    };
  }

  const summary = entries
    .map(
      (e) =>
        `- [${e.severity.toUpperCase()}] "${e.title}" (${e.status})${e.route ? ` @ ${e.route}` : ""}${e.component_hint ? ` — ${e.component_hint}` : ""}`
    )
    .join("\n");

  return {
    content: [
      {
        type: "text" as const,
        text: `${entries.length} revisiones encontradas:\n\n${summary}\n\nArchivos sincronizados en annotations/. Usa get_annotation con el ID para ver detalles.`,
      },
    ],
  };
}
