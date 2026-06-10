"use client";

import { useState, useRef, useEffect } from "react";
import { Upload, FileText, Loader2, Lock, HelpCircle, CheckCircle2, ImageIcon, KeyRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ParseResponse } from "@/types/import";
import { trackClientEvent } from "@/lib/utils/analytics";
import {
  suggestPdfPasswordsForAccount,
  createPdfPassword,
  type PdfPasswordSuggestion,
} from "@/actions/pdf-passwords";
import { toast } from "sonner";

const BANK_KEY_OVERRIDES: Record<string, string> = {
  banco_popular: "popular",
  cooperativa_confiar: "confiar",
};

function normalizeBankToKey(bank: string | undefined | null): string | null {
  if (!bank) return null;
  const lower = bank.toLowerCase();
  return BANK_KEY_OVERRIDES[lower] ?? lower.replace(/_/g, "-");
}

const PDF_EXTENSIONS = new Set([".pdf"]);
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_IMAGE_COUNT = 10;

export interface ParsedSourceMeta {
  source: "pdf" | "image";
  fileCount: number;
}

/**
 * Merge the ParseResponses of several partial screenshots into one.
 * Statements from the same bank/account are combined; transactions that
 * appear in more than one screenshot (overlapping captures) are deduped by
 * (date, amount, direction, description, installment).
 */
function mergeImageResponses(responses: ParseResponse[]): ParseResponse {
  const groups = new Map<string, ParseResponse["statements"][number]>();
  const seenTx = new Map<string, Set<string>>();

  for (const response of responses) {
    for (const statement of response.statements) {
      const key = [
        statement.bank,
        statement.statement_type,
        statement.account_number ?? statement.card_last_four ?? "",
      ].join("|");

      const existing = groups.get(key);
      if (!existing) {
        groups.set(key, { ...statement, transactions: [...statement.transactions] });
        seenTx.set(
          key,
          new Set(statement.transactions.map(txDedupKey))
        );
        continue;
      }

      const seen = seenTx.get(key)!;
      for (const tx of statement.transactions) {
        const txKey = txDedupKey(tx);
        if (seen.has(txKey)) continue;
        seen.add(txKey);
        existing.transactions.push(tx);
      }
      // Widen the covered period; prefer the first non-null metadata.
      if (statement.period_from && (!existing.period_from || statement.period_from < existing.period_from)) {
        existing.period_from = statement.period_from;
      }
      if (statement.period_to && (!existing.period_to || statement.period_to > existing.period_to)) {
        existing.period_to = statement.period_to;
      }
      existing.summary = existing.summary ?? statement.summary;
      existing.credit_card_metadata = existing.credit_card_metadata ?? statement.credit_card_metadata;
      existing.loan_metadata = existing.loan_metadata ?? statement.loan_metadata;
    }
  }

  for (const statement of groups.values()) {
    statement.transactions.sort((a, b) => a.date.localeCompare(b.date));
  }
  return { statements: [...groups.values()] };
}

function txDedupKey(tx: ParseResponse["statements"][number]["transactions"][number]): string {
  return [
    tx.date,
    tx.amount,
    tx.direction,
    tx.description.trim().toLowerCase(),
    tx.installment_current ?? "",
    // Disambiguates legitimately identical same-day transactions (two equal
    // ATM withdrawals) so overlap-dedup doesn't swallow one of them.
    tx.authorization_number ?? "",
  ].join("|");
}

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
  initialVaultSuggestions,
}: {
  onParsed: (data: ParseResponse, meta: ParsedSourceMeta) => void;
  initialFile?: File | null;
  initialVaultSuggestions?: PdfPasswordSuggestion[];
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [processingIndex, setProcessingIndex] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [passwordFromVault, setPasswordFromVault] = useState(false);
  const [savePassword, setSavePassword] = useState(false);
  const [saveAlias, setSaveAlias] = useState("");
  const [vaultSuggestions, setVaultSuggestions] = useState<PdfPasswordSuggestion[]>(
    initialVaultSuggestions ?? []
  );
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [unsupportedFile, setUnsupportedFile] = useState<File | null>(null);
  const [savingForSupport, setSavingForSupport] = useState(false);
  const [savedForSupport, setSavedForSupport] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialFileProcessed = useRef(false);

  useEffect(() => {
    if (initialVaultSuggestions) return;
    let cancelled = false;
    suggestPdfPasswordsForAccount(null, null).then((suggestions) => {
      if (cancelled) return;
      setVaultSuggestions(suggestions);
    });
    return () => {
      cancelled = true;
    };
  }, [initialVaultSuggestions]);

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

  function addFiles(incoming: File[]) {
    setError("");
    setUnsupportedFile(null);
    setSavedForSupport(false);

    const valid: File[] = [];
    for (const f of incoming) {
      const isImage = isImageFile(f.name);
      const isPdf = isPdfFile(f.name);
      if (!isImage && !isPdf) {
        setError("Formato no soportado. Se aceptan PDF, PNG, JPG o WEBP.");
        return;
      }
      const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_PDF_SIZE;
      if (f.size > maxSize) {
        setError(`"${f.name}" excede el tamaño máximo de ${maxSize / (1024 * 1024)}MB`);
        return;
      }
      valid.push(f);
    }
    if (valid.length === 0) return;

    // PDFs stay single-file (password flow is per-statement). Images can be
    // batched — bank apps often can't take long screenshots, so one statement
    // arrives as several partial captures.
    const firstPdf = valid.find((f) => isPdfFile(f.name));
    let next: File[];
    if (firstPdf) {
      next = [firstPdf];
      if (valid.length > 1) {
        toast.info("Los PDF se procesan de a uno — seleccioné el primero.");
      }
    } else {
      const merged = [...files.filter((f) => isImageFile(f.name)), ...valid];
      const unique = merged.filter(
        (f, i) => merged.findIndex((o) => o.name === f.name && o.size === f.size) === i
      );
      if (unique.length > MAX_IMAGE_COUNT) {
        toast.info(`Máximo ${MAX_IMAGE_COUNT} imágenes por importación.`);
      }
      next = unique.slice(0, MAX_IMAGE_COUNT);
    }
    setFiles(next);

    for (const f of valid) {
      void trackClientEvent({
        event_name: "import_file_selected",
        flow: "import",
        step: "upload",
        entry_point: "cta",
        success: true,
        metadata: {
          filename: f.name,
          file_size_bytes: f.size,
          file_type: isImageFile(f.name) ? "image" : "pdf",
          batch_size: next.length,
        },
      });
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  // Handle initialFile from FAB screenshot flow
  useEffect(() => {
    if (initialFile && !initialFileProcessed.current) {
      initialFileProcessed.current = true;
      addFiles([initialFile]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile]);

  async function handleUpload() {
    if (files.length === 0) return;
    setLoading(true);
    setError("");

    const isImage = isImageFile(files[0].name);

    try {
      void trackClientEvent({
        event_name: "import_parse_requested",
        flow: "import",
        step: "parse",
        entry_point: "cta",
        success: true,
        metadata: {
          has_password: !isImage && !!password,
          file_type: isImage ? "image" : "pdf",
          batch_size: files.length,
        },
      });

      const responses: ParseResponse[] = [];
      for (let i = 0; i < files.length; i++) {
        const current = files[i];
        if (files.length > 1) setProcessingIndex(i);

        const formData = new FormData();
        formData.append("file", current);
        if (!isImage && password) {
          formData.append("password", password);
        }

        const res = await fetch(isImage ? "/api/parse-image" : "/api/parse-statement", {
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
            setUnsupportedFile(current);
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
            const baseMsg = data.error || (isImage ? "Error procesando la imagen" : "Error procesando el PDF");
            setError(files.length > 1 ? `"${current.name}": ${baseMsg}. Quítala de la lista o intenta de nuevo.` : baseMsg);
          }
          setLoading(false);
          setProcessingIndex(null);
          return;
        }

        responses.push(data as ParseResponse);
      }
      setProcessingIndex(null);

      const parsed =
        responses.length > 1 ? mergeImageResponses(responses) : responses[0];
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
            ? "No se encontraron transacciones en las imágenes. Verifica que sean capturas de movimientos bancarios de un formato compatible."
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
          batch_size: files.length,
        },
      });

      if (savePassword && password && !passwordFromVault && saveAlias.trim()) {
        const bankKey = normalizeBankToKey(parsed.statements[0]?.bank);
        const fd = new FormData();
        fd.append("alias", saveAlias.trim());
        fd.append("password", password);
        if (bankKey) {
          fd.append("scope", "bank");
          fd.append("bank_key", bankKey);
        } else {
          fd.append("scope", "global");
        }
        const saveResult = await createPdfPassword(
          { success: false, error: "" },
          fd
        );
        if (saveResult.success) {
          toast.success("Contraseña guardada en tu bóveda");
        } else if (
          saveResult.error &&
          /alias|alcance/i.test(saveResult.error)
        ) {
          toast.info("Ya tenías esta contraseña guardada");
        } else {
          toast.error(saveResult.error ?? "No se pudo guardar la contraseña");
        }
      }

      onParsed(parsed, {
        source: isImage ? "image" : "pdf",
        fileCount: files.length,
      });
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
      setProcessingIndex(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-z-sage-dark">
          Archivo
        </p>
        <p className="text-[10px] italic text-z-sage-dark">PDF · PNG · JPG (varias imágenes)</p>
      </div>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex w-full flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors",
          dragging
            ? "border-z-brass bg-z-brass/12"
            : "border-z-brass/30 bg-z-brass/8 hover:border-z-brass/60 hover:bg-z-brass/12",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const dropped = Array.from(e.dataTransfer.files);
          if (dropped.length > 0) addFiles(dropped);
        }}
      >
        <Upload className="h-10 w-10 text-z-brass" />
        <div>
          <p className="text-base font-semibold text-z-white">
            Arrastra o toca para subir
          </p>
          <p className="mt-1 text-xs text-z-sage-dark">
            PDF hasta 10MB · imágenes hasta 20MB c/u — puedes subir varias capturas parciales
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          multiple
          className="hidden"
          onChange={(e) => {
            const selected = Array.from(e.target.files ?? []);
            if (selected.length > 0) addFiles(selected);
            e.target.value = "";
          }}
        />
      </button>

      {files.length === 0 && (
        <p className="text-center text-xs italic text-z-sage-dark">
          Detectamos el banco automáticamente — no tienes que elegirlo.
        </p>
      )}

      {files.length > 0 && (
        <div className="space-y-3">
          <div className="space-y-2">
            {files.map((f, i) => (
              <div key={`${f.name}-${f.size}`} className="flex items-center gap-3 rounded-md border p-3">
                {isImageFile(f.name) ? (
                  <ImageIcon className="h-5 w-5 shrink-0 text-muted-foreground" />
                ) : (
                  <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{f.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(f.size / 1024).toFixed(0)} KB
                    {loading && processingIndex === i && " · procesando…"}
                  </p>
                </div>
                {!loading && (
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    aria-label={`Quitar ${f.name}`}
                    className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <Button
            className={cn(BRASS_BUTTON_CLASS, "w-full")}
            onClick={handleUpload}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {files.length > 1 && processingIndex != null
                  ? `Procesando ${processingIndex + 1} de ${files.length}…`
                  : "Procesando..."}
              </>
            ) : files.length > 1 ? (
              `Procesar ${files.length} imágenes`
            ) : (
              "Procesar"
            )}
          </Button>
          {!isImageFile(files[0].name) && (
            <>
              <div className="flex items-center gap-3 rounded-md border p-3">
                <Lock className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <input
                    type="password"
                    placeholder="Contraseña del PDF (opcional)"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setPasswordFromVault(false);
                    }}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    autoComplete="off"
                  />
                </div>
                {vaultSuggestions.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className={cn(GHOST_BUTTON_CLASS, "shrink-0")}
                      >
                        <KeyRound className="h-4 w-4" />
                        Usar guardada
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {vaultSuggestions.map((sug) => (
                        <DropdownMenuItem
                          key={sug.id}
                          onSelect={() => {
                            setPassword(sug.password);
                            setPasswordFromVault(true);
                            setSavePassword(false);
                          }}
                        >
                          <span className="truncate">{sug.alias}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {sug.scope === "account"
                              ? "cuenta"
                              : sug.scope === "bank"
                              ? sug.bank_key
                              : "global"}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
              {password && !passwordFromVault && (
                <div className="rounded-md border border-dashed border-white/6 p-3 space-y-2">
                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={savePassword}
                      onChange={(e) => setSavePassword(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border border-white/6"
                    />
                    Guardar esta contraseña en la bóveda para próximos extractos
                  </label>
                  {savePassword && (
                    <Input
                      placeholder="Alias (ej: Cédula Cristian)"
                      value={saveAlias}
                      onChange={(e) => setSaveAlias(e.target.value)}
                      maxLength={60}
                      className="h-8 text-sm"
                    />
                  )}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Algunos extractos están protegidos con contraseña (ej. número de cédula).
                {vaultSuggestions.length > 0 && (
                  <> Tienes {vaultSuggestions.length} guardada{vaultSuggestions.length === 1 ? "" : "s"}.</>
                )}
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
                Este archivo no pudo ser procesado. ¿Quieres enviarlo para que podamos añadir soporte para este banco o formato?
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
                variant="ghost"
                className={cn(GHOST_BUTTON_CLASS, "!border-z-alert/30 hover:!bg-z-alert/10")}
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
                className={GHOST_BUTTON_CLASS}
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
