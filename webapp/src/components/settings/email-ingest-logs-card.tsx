"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, RefreshCw, ScrollText, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import { retryEmailIngestLog, dismissEmailIngestLog } from "@/actions/email-ingest";
import type { EmailIngestLog } from "@/types/domain";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  imported: { label: "Importado", className: "bg-emerald-500/20 text-emerald-500" },
  queued: { label: "En cola", className: "bg-z-brass/20 text-z-brass" },
  parsed: { label: "Parseado", className: "bg-z-brass/20 text-z-brass" },
  duplicate: { label: "Duplicado", className: "bg-white/6 text-muted-foreground" },
  parse_failed: { label: "Error", className: "bg-red-500/20 text-red-500" },
  sender_rejected: { label: "Remitente rechazado", className: "bg-amber-400/20 text-amber-400" },
  rate_limited: { label: "Límite excedido", className: "bg-amber-400/20 text-amber-400" },
  pdf_queued: { label: "PDF en cola", className: "bg-z-brass/20 text-z-brass" },
  pdf_parse_failed: { label: "PDF error", className: "bg-red-500/20 text-red-500" },
  pdf_imported: { label: "PDF importado", className: "bg-emerald-500/20 text-emerald-500" },
  dismissed: { label: "Descartado", className: "bg-white/6 text-muted-foreground" },
};

const RETRYABLE_STATUSES = new Set(["sender_rejected", "parse_failed", "rate_limited"]);

interface EmailIngestLogsCardProps {
  initialLogs: EmailIngestLog[];
}

export function EmailIngestLogsCard({ initialLogs }: EmailIngestLogsCardProps) {
  const [logs, setLogs] = useState(initialLogs);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);

  if (logs.length === 0) return null;

  const errorCount = logs.filter(
    (l) => l.status === "parse_failed" || l.status === "sender_rejected" || l.status === "pdf_parse_failed"
  ).length;

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleRetry(id: string) {
    setRetryingId(id);
    try {
      const result = await retryEmailIngestLog(id);
      if (result.success) {
        const messages: Record<string, string> = {
          imported: "Transacción importada correctamente",
          queued: "Transacción en cola para revisión",
          duplicate: "La transacción ya existía",
        };
        toast.success(messages[result.data] ?? "Procesado correctamente");
        setLogs((prev) => prev.filter((l) => l.id !== id));
      } else {
        toast.error(result.error || "No se pudo reprocesar el correo");
      }
    } finally {
      setRetryingId(null);
    }
  }

  async function handleDismiss(id: string) {
    setDismissingId(id);
    try {
      const result = await dismissEmailIngestLog(id);
      if (result.success) {
        setLogs((prev) => prev.filter((l) => l.id !== id));
      } else {
        toast.error(result.error || "No se pudo descartar");
      }
    } finally {
      setDismissingId(null);
    }
  }

  return (
    <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-black/10">
            <ScrollText className="size-4 text-z-brass" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle>Historial de correos</CardTitle>
              {errorCount > 0 && (
                <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-xs font-semibold text-red-500">
                  {errorCount} {errorCount === 1 ? "error" : "errores"}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Últimos {logs.length} correos procesados por el webhook. Revisa aquí si un correo no generó transacción.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="divide-y divide-white/6">
          {logs.map((log) => {
            const isExpanded = expanded.has(log.id);
            const isRetryable = RETRYABLE_STATUSES.has(log.status) && !!log.raw_body;
            const config = STATUS_CONFIG[log.status] ?? {
              label: log.status,
              className: "bg-white/6 text-muted-foreground",
            };

            return (
              <div key={log.id} className="px-6 py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleExpand(log.id)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  >
                    {isExpanded ? (
                      <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", config.className)}>
                          {config.label}
                        </span>
                        <span className="truncate text-sm text-muted-foreground">
                          {log.from_address}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground/60">
                        {formatDate(log.created_at)}
                      </p>
                    </div>
                  </button>
                  {isRetryable && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-muted-foreground hover:text-z-brass"
                        onClick={() => handleRetry(log.id)}
                        disabled={retryingId === log.id || dismissingId === log.id}
                        aria-label="Reintentar"
                      >
                        {retryingId === log.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <RefreshCw className="size-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDismiss(log.id)}
                        disabled={retryingId === log.id || dismissingId === log.id}
                        aria-label="Descartar"
                      >
                        {dismissingId === log.id ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <X className="size-4" />
                        )}
                      </Button>
                    </div>
                  )}
                </div>

                {isExpanded && (
                  <div className="mt-3 space-y-2 pl-7">
                    {log.error_message && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Error</p>
                        <p className="rounded-md border border-white/6 bg-black/20 px-3 py-2 text-xs text-red-500">
                          {log.error_message}
                        </p>
                      </div>
                    )}
                    {log.raw_body && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Contenido recibido</p>
                        <pre className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded-md border border-white/6 bg-black/20 p-3 text-xs leading-relaxed">
                          {log.raw_body}
                        </pre>
                      </div>
                    )}
                    {!log.error_message && !log.raw_body && (
                      <p className="text-xs text-muted-foreground italic">
                        Sin detalles adicionales
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
