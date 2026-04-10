"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, ScrollText } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import type { EmailIngestLog } from "@/types/domain";

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  imported: { label: "Importado", className: "bg-emerald-400/20 text-emerald-400" },
  queued: { label: "En cola", className: "bg-blue-400/20 text-blue-400" },
  parsed: { label: "Parseado", className: "bg-blue-400/20 text-blue-400" },
  duplicate: { label: "Duplicado", className: "bg-zinc-400/20 text-zinc-400" },
  parse_failed: { label: "Error", className: "bg-red-400/20 text-red-400" },
  sender_rejected: { label: "Remitente rechazado", className: "bg-amber-400/20 text-amber-400" },
  rate_limited: { label: "Límite excedido", className: "bg-amber-400/20 text-amber-400" },
  pdf_queued: { label: "PDF en cola", className: "bg-blue-400/20 text-blue-400" },
  pdf_parse_failed: { label: "PDF error", className: "bg-red-400/20 text-red-400" },
  pdf_imported: { label: "PDF importado", className: "bg-emerald-400/20 text-emerald-400" },
};

interface EmailIngestLogsCardProps {
  initialLogs: EmailIngestLog[];
}

export function EmailIngestLogsCard({ initialLogs }: EmailIngestLogsCardProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  if (initialLogs.length === 0) return null;

  const errorCount = initialLogs.filter(
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
                <span className="rounded-full bg-red-400/20 px-2 py-0.5 text-xs font-semibold text-red-400">
                  {errorCount} {errorCount === 1 ? "error" : "errores"}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              Últimos {initialLogs.length} correos procesados por el webhook. Revisa aquí si un correo no generó transacción.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="divide-y divide-white/6">
          {initialLogs.map((log) => {
            const isExpanded = expanded.has(log.id);
            const config = STATUS_CONFIG[log.status] ?? {
              label: log.status,
              className: "bg-zinc-400/20 text-zinc-400",
            };

            return (
              <div key={log.id} className="px-6 py-3">
                <button
                  onClick={() => toggleExpand(log.id)}
                  className="flex w-full items-center gap-3 text-left"
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

                {isExpanded && (
                  <div className="mt-3 space-y-2 pl-7">
                    {log.error_message && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Error</p>
                        <p className="rounded-md border border-border/40 bg-black/20 px-3 py-2 text-xs text-red-400">
                          {log.error_message}
                        </p>
                      </div>
                    )}
                    {log.raw_body && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Contenido recibido</p>
                        <pre className="max-h-36 overflow-y-auto whitespace-pre-wrap rounded-md border border-border/40 bg-black/20 p-3 text-xs leading-relaxed">
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
