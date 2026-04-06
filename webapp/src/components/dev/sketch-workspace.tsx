"use client";

import { useCallback, useState } from "react";
import { ImagePlus, FolderOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface SketchWorkspaceToolbarProps {
  onImportImage: (dataUrl: string) => void;
}

interface ReviewListItem {
  id: string;
  title: string;
  severity: string;
  annotation_path: string | null;
  created_at: string;
}

export function SketchWorkspaceToolbar({ onImportImage }: SketchWorkspaceToolbarProps) {
  const [showPreviousReviews, setShowPreviousReviews] = useState(false);
  const [reviews, setReviews] = useState<ReviewListItem[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);

  const handleFileImport = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onImportImage(reader.result);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  }, [onImportImage]);

  async function handleLoadReviews() {
    setLoadingReviews(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("design_reviews")
        .select("id, title, severity, annotation_path, created_at")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw new Error(error.message);
      setReviews(data ?? []);
      setShowPreviousReviews(true);
    } catch {
      toast.error("No se pudieron cargar las revisiones");
    } finally {
      setLoadingReviews(false);
    }
  }

  async function handleLoadReviewImage(annotationPath: string) {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.storage
        .from("design-reviews")
        .download(annotationPath);

      if (error || !data) throw new Error("No se pudo descargar");

      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          onImportImage(reader.result);
          setShowPreviousReviews(false);
        }
      };
      reader.readAsDataURL(data);
    } catch {
      toast.error("No se pudo cargar la imagen");
    }
  }

  const severityEmoji: Record<string, string> = {
    nit: "💅", bug: "🐛", idea: "💡", sketch: "✏️",
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleFileImport}
        className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-white/6 bg-z-surface-3 px-4 py-2.5 text-sm text-z-sage-light hover:bg-white/5 lg:min-h-0 lg:px-3 lg:py-1.5 lg:text-xs"
      >
        <ImagePlus className="size-4 lg:size-3.5" />
        Importar imagen
      </button>

      <button
        onClick={handleLoadReviews}
        disabled={loadingReviews}
        className="flex min-h-[44px] items-center gap-1.5 rounded-lg border border-white/6 bg-z-surface-3 px-4 py-2.5 text-sm text-z-sage-light hover:bg-white/5 lg:min-h-0 lg:px-3 lg:py-1.5 lg:text-xs"
      >
        <FolderOpen className="size-4 lg:size-3.5" />
        {loadingReviews ? "Cargando..." : "Revisiones previas"}
      </button>

      {showPreviousReviews && (
        <div className="absolute top-12 left-0 right-0 z-10 max-h-[50vh] w-auto overflow-y-auto rounded-xl border border-white/6 bg-z-surface-2 p-2 shadow-xl lg:right-auto lg:w-72">
          {reviews.length === 0 ? (
            <p className="p-2 text-xs text-z-sage-dark">No hay revisiones</p>
          ) : (
            reviews.map((r) => (
              <button
                key={r.id}
                onClick={() => r.annotation_path && handleLoadReviewImage(r.annotation_path)}
                disabled={!r.annotation_path}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/5 disabled:opacity-40"
              >
                <span>{severityEmoji[r.severity] ?? "📝"}</span>
                <span className="flex-1 truncate text-z-sage-light">{r.title}</span>
                <span className="text-[10px] text-z-sage-dark">
                  {new Date(r.created_at).toLocaleDateString("es-CO")}
                </span>
              </button>
            ))
          )}
          <button
            onClick={() => setShowPreviousReviews(false)}
            className="mt-1 w-full rounded-lg py-1 text-[11px] text-z-sage-dark hover:bg-white/5"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}
