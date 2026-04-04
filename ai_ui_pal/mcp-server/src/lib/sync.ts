import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { supabase } from "./supabase.js";
import { ANNOTATIONS_DIR } from "./paths.js";

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

  async function downloadIfMissing(remotePath: string, localFilename: string): Promise<string | null> {
    const filepath = join(ANNOTATIONS_DIR, localFilename);
    if (existsSync(filepath)) return `annotations/${localFilename}`;
    const { data } = await supabase.storage.from("design-reviews").download(remotePath);
    if (!data) return null;
    writeFileSync(filepath, Buffer.from(await data.arrayBuffer()));
    return `annotations/${localFilename}`;
  }

  const entries: IndexEntry[] = await Promise.all(
    (reviews as ReviewRecord[]).map(async (review) => {
      const [pngLocal, jsonLocal] = await Promise.all([
        review.annotation_path
          ? downloadIfMissing(review.annotation_path, `${review.id}.png`)
          : null,
        review.excalidraw_path
          ? downloadIfMissing(review.excalidraw_path, `${review.id}.excalidraw`)
          : null,
      ]);
      return {
        id: review.id,
        title: review.title,
        severity: review.severity,
        status: review.status,
        route: review.route,
        component_hint: review.component_hint,
        annotation_png: pngLocal,
        excalidraw_json: jsonLocal,
        created_at: review.created_at,
      };
    })
  );

  const indexPath = join(ANNOTATIONS_DIR, "index.json");
  writeFileSync(indexPath, JSON.stringify({ reviews: entries }, null, 2));

  return entries;
}
