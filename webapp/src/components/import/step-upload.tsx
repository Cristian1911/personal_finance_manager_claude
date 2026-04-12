"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, FileText, Loader2, Lock, HelpCircle, CheckCircle2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ParseResponse } from "@/types/import";
import { trackClientEvent } from "@/lib/utils/analytics";

const PDF_EXTENSIONS = new Set([".pdf"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20 MB

function getFileExtension(name: string): string {
  const dotIndex = name.lastIndexOf(".");
  return dotIndex !== -1 ? name.toLowerCase().slice(dotIndex) : "";
}

function isImageFile(name: string): boolean {
  return IMAGE_EXTENSIONS.has(getFileExtension(name));
}

function isPdfFile(name: string): boolean {
  return PDF_EXTENSIONS.has(getFileExtension(name));
}

export function StepUpload({
  onParsed,
  initialFile,
}: {
  onParsed: (data: ParseResponse) => void;
  initialFile?: File | null;
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
  const initialFileProcessed = useRef(false);

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

    const isImage = isImageFile(f.name);
    const isPdf = isPdfFile(f.name);

    if (!isImage && !isPdf) {
      setError("Formato no soportado. Se aceptan PDF, PNG, JPG o WEBP.");
      return;
    }
    const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_PDF_SIZE;
    if (f.size > maxSize) {
      setError(`El archivo excede el tamaño máximo de ${maxSize / (1024 * 1024)}MB`);
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
        file_type: isImage ? "image" : "pdf",
      },
    });
  }

  // Handle initialFile from FAB screenshot flow
  useEffect(() => {
    if (initialFile && !initialFileProcessed.current) {
      initialFileProcessed.current = true;
      handleFile(initialFile);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  async function handleUpload() {
    if (!file) return;
    setLoading(true);
    setError("");

    const isImage = isImageFile(file.name);
    const endpoint = isImage ? "/api/parse-image" : "/api/parse-statement";

    const formData = new FormData();
    formData.append("file", file);
    if (!isImage && password) {
      formData.append("password", password);
    }

    try {
      void trackClientEvent({
        event_name: "import_parse_requested",
        flow: "import",
        step: "parse",
        entry_point: "cta",
        success: true,
        metadata: { has_password: !isImage && !!password, file_type: isImage ? "image" : "pdf" },
      });

      const res = await fetch(endpoint, {
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
          setError(data.error || (isImage ? "Error procesando la imagen" : "Error procesando el PDF"));
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
          isImage
            ? "No se encontraron transacciones en esta imagen. Verifica que sea una captura de movimientos bancarios de un formato compatible."
            : "No se encontraron transacciones ni metadatos en este PDF. Verifica que sea un extracto bancario de un formato compatible."
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
            Arrastra tu extracto o captura de pantalla
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF (máx. 10MB) o imagen PNG/JPG (máx. 20MB)
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
          accept=".pdf,.png,.jpg,.jpeg,.webp"
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
            {isImageFile(file.name) ? (
              <ImageIcon className="h-5 w-5 text-muted-foreground" />
            ) : (
              <FileText className="h-5 w-5 text-muted-foreground" />
            )}
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
                "Procesar"
              )}
            </Button>
          </div>
          {!isImageFile(file.name) && (
            <>
              <div className="flex items-center gap-3 rounded-md border p-3">
                <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <input
                    type="password"
                    placeholder="Contraseña del PDF (opcional)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    autoComplete="off"
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Algunos extractos están protegidos con contraseña (ej. número de cédula).
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 text-destructive text-sm rounded-md p-3">
          {error}
        </div>
      )}

      {unsupportedFile && (
        <div className="rounded-md border border-z-alert/20 bg-z-alert/5 p-4 space-y-3">
          <div className="flex gap-3">
            <HelpCircle className="h-5 w-5 text-z-alert shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-z-alert">
                Formato no compatible
              </p>
              <p className="text-sm text-z-alert">
                Este PDF no pudo ser procesado. ¿Quieres enviarlo para que podamos añadir soporte para este banco o formato?
              </p>
            </div>
          </div>
          {savedForSupport ? (
            <div className="flex items-center gap-2 text-sm text-z-income">
              <CheckCircle2 className="h-4 w-4" />
              ¡Gracias! Lo revisaremos para añadir soporte pronto.
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-z-alert/30 hover:bg-z-alert/10"
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
