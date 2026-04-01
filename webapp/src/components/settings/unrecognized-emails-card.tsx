"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, X, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { dismissUnrecognizedEmail } from "@/actions/email-ingest";
import { formatDate } from "@/lib/utils/date";
import type { UnrecognizedEmail } from "@/types/domain";

interface UnrecognizedEmailsCardProps {
  initialEmails: UnrecognizedEmail[];
}

export function UnrecognizedEmailsCard({ initialEmails }: UnrecognizedEmailsCardProps) {
  const [emails, setEmails] = useState(initialEmails);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  if (emails.length === 0) return null;

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
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDismiss(email.id)}
                    disabled={isPending}
                    aria-label="Descartar"
                  >
                    {isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <X className="size-4" />
                    )}
                  </Button>
                </div>

                {isExpanded && (
                  <div className="mt-3 space-y-2">
                    {email.text_body && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">Texto plano</p>
                        <pre className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-md border border-border/40 bg-black/20 p-3 text-xs leading-relaxed">
                          {email.text_body}
                        </pre>
                      </div>
                    )}
                    {email.html_body && !email.text_body && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground">HTML (sin texto plano)</p>
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
