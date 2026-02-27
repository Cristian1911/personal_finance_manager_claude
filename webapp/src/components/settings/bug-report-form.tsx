"use client";

import { useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

export function BugReportForm() {
  const pathname = usePathname();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [routeHint, setRouteHint] = useState(pathname ?? "");
  const [selectedAreaHint, setSelectedAreaHint] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () => title.trim().length > 3 && description.trim().length > 8 && !submitting,
    [title, description, submitting]
  );

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setError(null);
    if (!file) {
      setAttachment(null);
      return;
    }

    if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
      setAttachment(null);
      setFileInputKey((prev) => prev + 1);
      setError("El adjunto no puede superar 10MB.");
      return;
    }

    if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(file.type)) {
      setAttachment(null);
      setFileInputKey((prev) => prev + 1);
      setError("Formato no soportado. Usa JPG, PNG, WEBP o PDF.");
      return;
    }

    setAttachment(file);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      const payload = new FormData();
      payload.append("title", title.trim());
      payload.append("description", description.trim());
      payload.append("route_hint", routeHint.trim());
      payload.append("selected_area_hint", selectedAreaHint.trim());
      payload.append("source", "web");
      payload.append(
        "device_context",
        JSON.stringify({
          platform: "web",
          pathname,
          language: navigator.language,
          userAgent: navigator.userAgent,
          viewport: `${window.innerWidth}x${window.innerHeight}`,
        })
      );
      if (attachment) {
        payload.append("attachment", attachment);
      }

      const response = await fetch("/api/bug-reports", {
        method: "POST",
        body: payload,
      });

      const body = (await response.json().catch(() => null)) as
        | { id?: string; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(body?.error || "No se pudo enviar el reporte.");
      }

      toast.success(
        `Reporte enviado${body?.id ? ` (ticket ${body.id.slice(0, 8)})` : ""}.`
      );

      setTitle("");
      setDescription("");
      setSelectedAreaHint("");
      setAttachment(null);
      setFileInputKey((prev) => prev + 1);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "No se pudo enviar el reporte.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-sm">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="bug-title">Título</Label>
        <Input
          id="bug-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Ej: En editar transacción se solapan fecha y cuenta"
          required
          minLength={4}
          maxLength={160}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bug-description">Descripción</Label>
        <textarea
          id="bug-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Qué hiciste, qué esperabas y qué pasó."
          minLength={9}
          maxLength={4000}
          required
          className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring min-h-28 w-full rounded-md border px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bug-route">Pantalla/Ruta (opcional)</Label>
        <Input
          id="bug-route"
          value={routeHint}
          onChange={(event) => setRouteHint(event.target.value)}
          placeholder="/transactions/123"
          maxLength={300}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bug-area">Zona afectada (opcional)</Label>
        <Input
          id="bug-area"
          value={selectedAreaHint}
          onChange={(event) => setSelectedAreaHint(event.target.value)}
          placeholder="Bloque superior derecho / botón Guardar"
          maxLength={500}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="bug-attachment">Adjunto (opcional)</Label>
        <Input
          key={fileInputKey}
          id="bug-attachment"
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          onChange={handleAttachmentChange}
        />
        <p className="text-muted-foreground text-xs">
          Formatos soportados: JPG, PNG, WEBP, PDF. Máximo 10MB.
        </p>
        {attachment && (
          <div className="bg-muted rounded-md p-2 text-xs">
            <p className="font-medium">{attachment.name}</p>
            <p className="text-muted-foreground">{formatBytes(attachment.size)}</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 h-7 px-2 text-xs"
              onClick={() => {
                setAttachment(null);
                setFileInputKey((prev) => prev + 1);
              }}
            >
              Quitar adjunto
            </Button>
          </div>
        )}
      </div>

      <Button type="submit" disabled={!canSubmit}>
        {submitting ? "Enviando..." : "Enviar ticket"}
      </Button>
    </form>
  );
}
