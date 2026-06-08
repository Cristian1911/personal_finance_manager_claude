"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type Severity = "nit" | "bug" | "idea" | "sketch";

interface ReviewSaveDialogProps {
  excalidrawJson: string;
  pngBlob: Blob;
  componentHint: string | null;
  onSaved: () => void;
  onCancel: () => void;
}

const severityOptions: { value: Severity; label: string; emoji: string }[] = [
  { value: "nit", label: "Nit", emoji: "💅" },
  { value: "bug", label: "Bug", emoji: "🐛" },
  { value: "idea", label: "Idea", emoji: "💡" },
  { value: "sketch", label: "Sketch", emoji: "✏️" },
];

export function ReviewSaveDialog({
  excalidrawJson,
  pngBlob,
  componentHint,
  onSaved,
  onCancel,
}: ReviewSaveDialogProps) {
  const pathname = usePathname();
  const [title, setTitle] = useState("");
  const [severity, setSeverity] = useState<Severity>("bug");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("No autenticado");

      const timestamp = Date.now();
      const slug = title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .slice(0, 40);
      const basePath = `${user.id}/${timestamp}-${slug}`;

      const jsonBlob = new Blob([excalidrawJson], { type: "application/json" });
      const [pngResult, jsonResult] = await Promise.all([
        supabase.storage.from("design-reviews").upload(`${basePath}.png`, pngBlob, {
          contentType: "image/png",
          upsert: false,
        }),
        supabase.storage.from("design-reviews").upload(`${basePath}.excalidraw`, jsonBlob, {
          contentType: "application/json",
          upsert: false,
        }),
      ]);
      if (pngResult.error) throw new Error(pngResult.error.message);
      if (jsonResult.error) throw new Error(jsonResult.error.message);

      // Insert review record
      const { error: insertError } = await supabase
        .from("design_reviews")
        .insert({
          user_id: user.id,
          title: title.trim(),
          severity,
          route: pathname,
          component_hint: componentHint,
          annotation_path: `${basePath}.png`,
          excalidraw_path: `${basePath}.excalidraw`,
          device_context: {
            platform: "web",
            viewport: `${window.innerWidth}x${window.innerHeight}`,
            userAgent: navigator.userAgent,
          },
        });
      if (insertError) throw new Error(insertError.message);

      toast.success("Revisión guardada");
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[var(--z-layer-dev)] flex items-end justify-center bg-black/60 lg:items-center">
      <div className="w-full max-w-none rounded-t-2xl border border-white/6 bg-z-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl lg:max-w-sm lg:rounded-2xl lg:pb-5">
        <h3 className="text-base font-semibold text-z-white">
          Guardar revisión
        </h3>

        {componentHint && (
          <p className="mt-1 text-xs text-z-brass">
            Componente: {componentHint}
          </p>
        )}

        <input
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="¿Qué hay que arreglar?"
          className="mt-3 w-full rounded-lg border border-white/6 bg-z-surface-2 px-3 py-3 text-base text-z-white placeholder:text-z-sage-dark outline-none focus:border-z-brass lg:py-2 lg:text-sm"
          maxLength={160}
        />

        <div className="mt-3 flex gap-1.5">
          {severityOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSeverity(opt.value)}
              className={`flex-1 min-h-[44px] rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors lg:min-h-0 lg:py-1.5 lg:text-xs ${
                severity === opt.value
                  ? "border-z-brass bg-z-brass/10 text-z-brass"
                  : "border-white/6 text-z-sage-light hover:bg-white/5"
              }`}
            >
              {opt.emoji} {opt.label}
            </button>
          ))}
        </div>

        <p className="mt-2 text-[11px] text-z-sage-dark">Ruta: {pathname}</p>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 min-h-[44px] rounded-lg border border-white/6 bg-z-surface-3 py-3 text-sm text-z-sage-light lg:min-h-0 lg:py-2 lg:text-xs"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saving}
            className="flex flex-1 min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-z-brass py-3 text-sm font-semibold text-z-ink disabled:opacity-50 lg:min-h-0 lg:py-2 lg:text-xs"
          >
            <Save className="size-4 lg:size-3.5" />
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}
