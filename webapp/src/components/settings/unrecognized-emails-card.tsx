"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, ClipboardList, Copy, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { dismissUnrecognizedEmail, retryUnrecognizedEmail } from "@/actions/email-ingest";
import { formatDate } from "@/lib/utils/date";
import type { UnrecognizedEmail } from "@/types/domain";

interface UnrecognizedEmailsCardProps {
  initialEmails: UnrecognizedEmail[];
}

export function UnrecognizedEmailsCard({ initialEmails }: UnrecognizedEmailsCardProps) {
  const [emails, setEmails] = useState(initialEmails);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();
  const [retryingId, setRetryingId] = useState<string | null>(null);

  if (emails.length === 0) return null;

  function buildReport(email: UnrecognizedEmail) {
    const body = (email.text_body || email.html_body)?.slice(0, 3000) || "(sin contenido)";
    const type = email.text_body ? "text" : "html";
    return [
      `## Correo no reconocido`,
      ``,
      `- **Remitente:** ${email.from_address}`,
      email.subject ? `- **Asunto:** ${email.subject}` : null,
      `- **Fecha:** ${email.created_at}`,
      `- **Tipo de cuerpo:** ${type}`,
      ``,
      `### Contenido`,
      `\`\`\`\``,
      body,
      `\`\`\`\``,
    ].filter(Boolean).join("\n");
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDismiss(id: string) {
    startTransition(async () => {
      const result = await dismissUnrecognizedEmail(id);
      if (result.success) {
        setEmails((prev) => prev.filter((e) => e.id !== id));
      }
    });
  }

  async function handleRetry(id: string) {
    setRetryingId(id);
    try {
      const result = await retryUnrecognizedEmail(id);
      if (result.success) {
        const messages: Record<string, string> = {
          imported: "Transacción importada correctamente",
          queued: "Transacción en cola para revisión",
          duplicate: "La transacción ya existía",
        };
        toast.success(messages[result.data] ?? "Procesado correctamente");
        setEmails((prev) => prev.filter((e) => e.id !== id));
      } else {
        toast.error(result.error || "No se pudo reprocesar el correo");
      }
    } finally {
      setRetryingId(null);
    }
  }

  return (
    <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-black/10">
            <AlertTriangle className="size-4 text-amber-400" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle>Correos no reconocidos</CardTitle>
              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-xs font-semibold text-amber-400">
                {emails.length}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Correos que llegaron pero no coincidieron con ningún patrón del parser.
              Revisarlos ayuda a mejorar la detección automática.
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="divide-y divide-white/6">
          {emails.map((email) => {
            const isExpanded = expanded.has(email.id);
            return (
              <div key={email.id} className="px-6 py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => toggleExpand(email.id)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    {isExpanded ? (
                      <ChevronUp className="size-4 shrink-0 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {email.subject || email.from_address}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {email.from_address} · {formatDate(email.created_at)}
                      </p>
                    </div>
                  </button>
                  <div className="flex shrink-0 gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-muted-foreground hover:text-amber-400"
                      onClick={() => {
                        navigator.clipboard.writeText(buildReport(email));
                        toast.success("Reporte copiado — pégalo en un issue de GitHub");
                      }}
                      aria-label="Copiar reporte"
                    >
                      <ClipboardList className="size-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-muted-foreground hover:text-z-brass"
                      onClick={() => handleRetry(email.id)}
                      disabled={retryingId === email.id || isPending}
                      aria-label="Reintentar"
                    >
                      {retryingId === email.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RefreshCw className="size-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDismiss(email.id)}
                      disabled={isPending || retryingId === email.id}
                      aria-label="Descartar"
                    >
                      {isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <X className="size-4" />
                      )}
                    </Button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-3 space-y-2">
                    {email.text_body && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground">Texto plano</p>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6 text-muted-foreground hover:text-z-brass"
                            onClick={() => {
                              navigator.clipboard.writeText(email.text_body!);
                              toast.success("Contenido copiado");
                            }}
                            aria-label="Copiar contenido"
                          >
                            <Copy className="size-3" />
                          </Button>
                        </div>
                        <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-border/40 bg-black/20 p-3 text-xs leading-relaxed">
                          {email.text_body}
                        </pre>
                      </div>
                    )}
                    {email.html_body && !email.text_body && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-muted-foreground">HTML (sin texto plano)</p>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-6 text-muted-foreground hover:text-z-brass"
                            onClick={() => {
                              navigator.clipboard.writeText(email.html_body!);
                              toast.success("Contenido copiado");
                            }}
                            aria-label="Copiar contenido"
                          >
                            <Copy className="size-3" />
                          </Button>
                        </div>
                        <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-border/40 bg-black/20 p-3 text-xs leading-relaxed">
                          {email.html_body.slice(0, 2000)}
                        </pre>
                      </div>
                    )}
                    {!email.text_body && !email.html_body && (
                      <p className="text-xs text-muted-foreground italic">
                        Sin contenido disponible
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
