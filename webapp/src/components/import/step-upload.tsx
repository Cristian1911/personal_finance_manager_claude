"use client";

import { useState, useRef } from "react";
import { Upload, FileText, Loader2, Lock, HelpCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ParseResponse } from "@/types/import";
import { trackClientEvent } from "@/lib/utils/analytics";

export function StepUpload({
  onParsed,
}: {
  onParsed: (data: ParseResponse) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unsupportedFile, setUnsupportedFile] = useState<File | null>(null);
  const [savingForSupport, setSavingForSupport] = useState(false);
  const [savedForSupport, setSavedForSupport] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSaveForSupport() {
    if (!unsupportedFile) return;
    setSavingForSupport(true);
    const formData = new FormData();
    formData.append("file", unsupportedFile);
    try {
      await fetch("/api/save-unrecognized", { method: "POST", body: formData });
      setSavedForSupport(true);
    } finally {
      setSavingForSupport(false);
    }
  }

  function handleFile(f: File) {
    setError("");
    setUnsupportedFile(null);
    setSavedForSupport(false);
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setError("El archivo debe ser un PDF");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("El archivo excede el tamaño máximo de 10MB");
      return;
    }
    setFile(f);
    void trackClientEvent({
      event_name: "import_file_selected",
      flow: "import",
      step: "upload",
      entry_point: "cta",
      success: true,
      metadata: {
        filename: f.name,
        file_size_bytes: f.size,
      },
    });
  }

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError("");

    const formData = new FormData();
    formData.append("file", file);
    if (password) {
      formData.append("password", password);
    }

    try {
      void trackClientEvent({
        event_name: "import_parse_requested",
        flow: "import",
        step: "parse",
        entry_point: "cta",
        success: true,
        metadata: { has_password: !!password },
      });

      const res = await fetch("/api/parse-statement", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.errorType === "unsupported_format") {
          void trackClientEvent({
            event_name: "import_parse_failed",
            flow: "import",
            step: "parse",
            entry_point: "cta",
            success: false,
            error_code: "unsupported_format",
          });
          setUnsupportedFile(file);
          setSavedForSupport(false);
        } else {
          void trackClientEvent({
            event_name: "import_parse_failed",
            flow: "import",
            step: "parse",
            entry_point: "cta",
            success: false,
            error_code: "parse_api_error",
          });
          setError(data.error || "Error procesando el PDF");
        }
        setLoading(false);
        return;
      }

      const parsed = data as ParseResponse;
      const totalTx = parsed.statements.reduce(
        (sum: number, s: ParseResponse["statements"][number]) =>
          sum + s.transactions.length,
        0
      );
      const hasMetadata = parsed.statements.some(
        (s) => s.credit_card_metadata || s.loan_metadata || s.summary
      );
      if (totalTx === 0 && !hasMetadata) {
        void trackClientEvent({
          event_name: "import_parse_failed",
          flow: "import",
          step: "parse",
          entry_point: "cta",
          success: false,
          error_code: "empty_parse_result",
        });
        setError(
          "No se encontraron transacciones ni metadatos en este PDF. Verifica que sea un extracto bancario de un formato compatible."
        );
        setLoading(false);
        return;
      }

      void trackClientEvent({
        event_name: "import_parse_succeeded",
        flow: "import",
        step: "parse",
        entry_point: "cta",
        success: true,
        metadata: {
          statements_count: parsed.statements.length,
          transactions_detected: totalTx,
          has_metadata: hasMetadata,
        },
      });
      onParsed(data as ParseResponse);
    } catch {
      void trackClientEvent({
        event_name: "import_parse_failed",
        flow: "import",
        step: "parse",
        entry_point: "cta",
        success: false,
        error_code: "network_error",
      });
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div
        className={`relative flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-12 transition-colors ${
          dragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const droppedFile = e.dataTransfer.files[0];
          if (droppedFile) handleFile(droppedFile);
        }}
      >
        <Upload className="h-10 w-10 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium">
            Arrastra tu extracto bancario aquí
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            o haz clic para seleccionar un archivo PDF (máx. 10MB)
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
        >
          Seleccionar archivo
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </div>

      {file && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-md border p-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(file.size / 1024).toFixed(0)} KB
              </p>
            </div>
            <Button onClick={handleUpload} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Procesando...
                </>
              ) : (
                "Procesar extracto"
              )}
            </Button>
          </div>
          <div className="flex items-center gap-3 rounded-md border p-3">
            <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <input
                type="password"
                placeholder="Contraseña del PDF (opcional)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Algunos extractos están protegidos con contraseña (ej. número de cédula).
          </p>
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm rounded-md p-3">
          {error}
        </div>
      )}

      {unsupportedFile && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 space-y-3 dark:border-amber-900 dark:bg-amber-950/30">
          <div className="flex gap-3">
            <HelpCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                Formato no compatible
              </p>
              <p className="text-sm text-amber-700 dark:text-amber-300">
                Este PDF no pudo ser procesado. ¿Quieres enviarlo para que podamos añadir soporte para este banco o formato?
              </p>
            </div>
          </div>
          {savedForSupport ? (
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              ¡Gracias! Lo revisaremos para añadir soporte pronto.
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-amber-300 hover:bg-amber-100 dark:border-amber-700 dark:hover:bg-amber-900"
                onClick={handleSaveForSupport}
                disabled={savingForSupport}
              >
                {savingForSupport ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  "Sí, enviar para soporte"
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setUnsupportedFile(null)}
                disabled={savingForSupport}
              >
                No, gracias
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
