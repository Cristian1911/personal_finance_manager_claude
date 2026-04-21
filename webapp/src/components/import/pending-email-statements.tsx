"use client";

import { useState, useTransition } from "react";
import {
  FileText,
  Loader2,
  Lock,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  X,
  RefreshCw,
  Clock,
} from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import {
  dismissEmailPdfStatement,
  retryPdfParsing,
} from "@/actions/email-pdf-ingest";
import type { PendingEmailStatement } from "@/types/domain";
import { formatRelativeDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";

// ── Status helpers ───────────────────────────────────────────────────────────

type StatusConfig = {
  label: string;
  icon: typeof Clock;
  className: string;
};

const STATUS_MAP: Record<string, StatusConfig> = {
  pending: {
    label: "Procesando",
    icon: Clock,
    className: "text-z-brass bg-z-brass/10 border-z-brass/20",
  },
  parsing: {
    label: "Analizando",
    icon: Loader2,
    className: "text-z-brass bg-z-brass/10 border-z-brass/20",
  },
  parsed: {
    label: "Listo para revisar",
    icon: CheckCircle2,
    className: "text-z-income bg-z-income/10 border-z-income/20",
  },
  needs_password: {
    label: "Necesita contraseña",
    icon: Lock,
    className: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  },
  parse_failed: {
    label: "Error al procesar",
    icon: AlertTriangle,
    className: "text-destructive bg-destructive/10 border-destructive/20",
  },
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Component ────────────────────────────────────────────────────────────────

interface PendingEmailStatementsProps {
  statements: PendingEmailStatement[];
  onReviewStatement?: (statement: PendingEmailStatement) => void;
}

export function PendingEmailStatements({
  statements: initialStatements,
  onReviewStatement,
}: PendingEmailStatementsProps) {
  const [statements, setStatements] = useState(initialStatements);
  const [isPending, startTransition] = useTransition();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [passwordInputs, setPasswordInputs] = useState<Record<string, string>>({});
  const [open, setOpen] = useState(false);

  if (statements.length === 0) return null;

  function handleDismiss(id: string) {
    setActiveId(id);
    startTransition(async () => {
      try {
        const result = await dismissEmailPdfStatement(id);
        if (result.success) {
          setStatements((prev) => prev.filter((s) => s.id !== id));
        } else {
          toast.error(result.error);
        }
      } catch {
        setStatements((prev) => prev.filter((s) => s.id !== id));
      }
      setActiveId(null);
    });
  }

  function handleRetryWithPassword(id: string) {
    const password = passwordInputs[id]?.trim();
    if (!password) {
      toast.error("Ingresa la contraseña del PDF");
      return;
    }
    setActiveId(id);
    startTransition(async () => {
      try {
        const result = await retryPdfParsing(id, password);
        if (result.success) {
          setStatements((prev) =>
            prev.map((s) =>
              s.id === id ? { ...s, status: "parsed", error_message: null } : s,
            ),
          );
          toast.success("PDF procesado correctamente");
        } else {
          toast.error(result.error);
        }
      } catch {
        toast.error("Error al reintentar");
      }
      setActiveId(null);
    });
  }

  const parsedCount = statements.filter((s) => s.status === "parsed").length;
  const needsPasswordCount = statements.filter((s) => s.status === "needs_password").length;
  const errorCount = statements.filter((s) => s.status === "parse_failed").length;
  const processingCount = statements.filter(
    (s) => s.status === "pending" || s.status === "parsing",
  ).length;

  const summaryParts: string[] = [];
  if (parsedCount > 0)
    summaryParts.push(`${parsedCount} ${parsedCount === 1 ? "listo" : "listos"}`);
  if (needsPasswordCount > 0)
    summaryParts.push(
      `${needsPasswordCount} necesita${needsPasswordCount === 1 ? "" : "n"} clave`,
    );
  if (errorCount > 0)
    summaryParts.push(`${errorCount} con error`);
  if (processingCount > 0 && summaryParts.length === 0)
    summaryParts.push(`${processingCount} en proceso`);

  return (
    <Card className="border-white/6 bg-z-surface-2/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-white/5"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <FileText className="size-4 shrink-0 text-z-brass" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-z-white">
              Cola de importación
            </p>
            <p className="truncate text-xs text-z-sage-dark">
              {summaryParts.length > 0
                ? summaryParts.join(" · ")
                : `${statements.length} ${statements.length === 1 ? "entrada" : "entradas"}`}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {parsedCount > 0 && (
            <span className="rounded-full bg-z-income/20 px-2 py-0.5 text-[11px] font-semibold text-z-income">
              {parsedCount}
            </span>
          )}
          {needsPasswordCount > 0 && (
            <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-[11px] font-semibold text-amber-400">
              {needsPasswordCount}
            </span>
          )}
          {errorCount > 0 && (
            <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-semibold text-destructive">
              {errorCount}
            </span>
          )}
          <ChevronDown
            className={cn(
              "size-4 text-z-sage-dark transition-transform",
              open && "rotate-180",
            )}
          />
        </div>
      </button>
      {open && (
      <CardContent className="border-t border-white/6 p-0">
        <div className="divide-y divide-white/6">
          {statements.map((stmt) => {
            const config = STATUS_MAP[stmt.status] ?? STATUS_MAP.pending;
            const StatusIcon = config.icon;
            const isLoading = isPending && activeId === stmt.id;
            const statementsCount =
              stmt.status === "parsed" && Array.isArray(stmt.parsed_data)
                ? (stmt.parsed_data as unknown[]).length
                : null;

            return (
              <div key={stmt.id} className="px-6 py-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/5">
                    <FileText className="size-4 text-muted-foreground" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {stmt.original_filename ?? "extracto.pdf"}
                    </p>
                    <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span>{formatRelativeDate(stmt.created_at)}</span>
                      {stmt.file_size_bytes && (
                        <>
                          <span>·</span>
                          <span>{formatFileSize(stmt.file_size_bytes)}</span>
                        </>
                      )}
                      {stmt.from_address && (
                        <>
                          <span>·</span>
                          <span className="truncate">{stmt.from_address}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                      config.className,
                    )}
                  >
                    <StatusIcon
                      className={cn(
                        "size-3",
                        stmt.status === "parsing" && "animate-spin",
                      )}
                    />
                    {config.label}
                    {statementsCount != null && (
                      <span className="text-muted-foreground">
                        · {statementsCount} {statementsCount === 1 ? "extracto" : "extractos"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Error message */}
                {stmt.error_message && stmt.status !== "needs_password" && (
                  <p className="text-xs text-destructive pl-12">
                    {stmt.error_message}
                  </p>
                )}

                {/* Password input for encrypted PDFs */}
                {stmt.status === "needs_password" && (
                  <div className="flex items-center gap-2 pl-12">
                    <Input
                      type="password"
                      placeholder="Contraseña del PDF"
                      className="h-8 max-w-[200px] text-sm"
                      value={passwordInputs[stmt.id] ?? ""}
                      onChange={(e) =>
                        setPasswordInputs((prev) => ({
                          ...prev,
                          [stmt.id]: e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleRetryWithPassword(stmt.id);
                      }}
                      autoComplete="off"
                    />
                    <Button
                      size="sm"
                      className={cn(BRASS_BUTTON_CLASS, "h-8 gap-1.5 text-xs")}
                      onClick={() => handleRetryWithPassword(stmt.id)}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3.5" />
                      )}
                      Reintentar
                    </Button>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center gap-2 pl-12">
                  {stmt.status === "parsed" && onReviewStatement && (
                    <Button
                      size="sm"
                      className={cn(BRASS_BUTTON_CLASS, "h-7 gap-1.5 text-xs")}
                      onClick={() => onReviewStatement(stmt)}
                    >
                      Revisar e importar
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                    onClick={() => handleDismiss(stmt.id)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <X className="size-3.5" />
                    )}
                    Descartar
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
      )}
    </Card>
  );
}
