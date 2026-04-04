import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { TextContent, ImageContent } from "@modelcontextprotocol/sdk/types.js";
import { supabase } from "../lib/supabase.js";
import { ANNOTATIONS_DIR } from "../lib/paths.js";

export const getAnnotationSchema = {
  review_id: z.string().describe("UUID de la revisión de diseño"),
  format: z
    .enum(["json", "image", "both"])
    .optional()
    .describe("Qué retornar (por defecto: both)"),
};

export const getAnnotationDescription =
  "Lee la anotación de una revisión de diseño específica. Retorna el JSON de Excalidraw y/o la imagen PNG.";

export async function getAnnotationHandler(args: {
  review_id: string;
  format?: "json" | "image" | "both";
}) {
  const format = args.format ?? "both";
  const content: Array<TextContent | ImageContent> = [];

  if (format === "json" || format === "both") {
    const localJson = join(ANNOTATIONS_DIR, `${args.review_id}.excalidraw`);
    if (existsSync(localJson)) {
      content.push({ type: "text", text: readFileSync(localJson, "utf-8") });
    } else {
      const { data: review } = await supabase
        .from("design_reviews")
        .select("excalidraw_path")
        .eq("id", args.review_id)
        .single();
      if (review?.excalidraw_path) {
        const { data } = await supabase.storage
          .from("design-reviews")
          .download(review.excalidraw_path);
        if (data) content.push({ type: "text", text: await data.text() });
      }
    }
  }

  if (format === "image" || format === "both") {
    const localPng = join(ANNOTATIONS_DIR, `${args.review_id}.png`);
    if (existsSync(localPng)) {
      const imageData = readFileSync(localPng).toString("base64");
      content.push({ type: "image", data: imageData, mimeType: "image/png" });
    }
  }

  if (content.length === 0) {
    content.push({
      type: "text",
      text: `No se encontró la anotación para review ${args.review_id}`,
    });
  }

  return { content };
}
