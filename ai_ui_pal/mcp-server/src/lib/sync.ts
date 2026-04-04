import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { supabase } from "./supabase.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ANNOTATIONS_DIR = join(__dirname, "../../annotations");

interface ReviewRecord {
  id: string;
  title: string;
  severity: string;
  status: string;
  route: string | null;
  component_hint: string | null;
  annotation_path: string | null;
  excalidraw_path: string | null;
  created_at: string;
}

export interface IndexEntry {
  id: string;
  title: string;
  severity: string;
  status: string;
  route: string | null;
  component_hint: string | null;
  annotation_png: string | null;
  excalidraw_json: string | null;
  created_at: string;
}

export async function syncReviews(
  statuses: string[] = ["open", "in_progress"]
): Promise<IndexEntry[]> {
  if (!existsSync(ANNOTATIONS_DIR)) {
    mkdirSync(ANNOTATIONS_DIR, { recursive: true });
  }

  const { data: reviews, error } = await supabase
    .from("design_reviews")
    .select(
      "id, title, severity, status, route, component_hint, annotation_path, excalidraw_path, created_at"
    )
    .in("status", statuses)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  if (!reviews || reviews.length === 0) return [];

  const entries: IndexEntry[] = [];

  for (const review of reviews as ReviewRecord[]) {
    let pngLocal: string | null = null;
    let jsonLocal: string | null = null;

    if (review.annotation_path) {
      const { data } = await supabase.storage
        .from("design-reviews")
        .download(review.annotation_path);
      if (data) {
        const filename = `${review.id}.png`;
        const filepath = join(ANNOTATIONS_DIR, filename);
        writeFileSync(filepath, Buffer.from(await data.arrayBuffer()));
        pngLocal = `annotations/${filename}`;
      }
    }

    if (review.excalidraw_path) {
      const { data } = await supabase.storage
        .from("design-reviews")
        .download(review.excalidraw_path);
      if (data) {
        const filename = `${review.id}.excalidraw`;
        const filepath = join(ANNOTATIONS_DIR, filename);
        writeFileSync(filepath, Buffer.from(await data.arrayBuffer()));
        jsonLocal = `annotations/${filename}`;
      }
    }

    entries.push({
      id: review.id,
      title: review.title,
      severity: review.severity,
      status: review.status,
      route: review.route,
      component_hint: review.component_hint,
      annotation_png: pngLocal,
      excalidraw_json: jsonLocal,
      created_at: review.created_at,
    });
  }

  const indexPath = join(ANNOTATIONS_DIR, "index.json");
  writeFileSync(indexPath, JSON.stringify({ reviews: entries }, null, 2));

  return entries;
}
