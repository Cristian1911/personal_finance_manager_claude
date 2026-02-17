"use client";

import { useState, useRef } from "react";
import { Upload, FileText, Loader2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ParseResponse } from "@/types/import";

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
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setError("");
    if (!f.name.toLowerCase().endsWith(".pdf")) {
      setError("El archivo debe ser un PDF");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError("El archivo excede el tamaño máximo de 10MB");
      return;
    }
    setFile(f);
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
      const res = await fetch("/api/parse-statement", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Error procesando el PDF");
        setLoading(false);
        return;
      }

      const totalTx = (data as ParseResponse).statements.reduce(
        (sum: number, s: ParseResponse["statements"][number]) =>
          sum + s.transactions.length,
        0
      );
      if (totalTx === 0) {
        setError(
          "No se encontraron transacciones en este PDF. Verifica que sea un extracto bancario de un formato compatible."
        );
        setLoading(false);
        return;
      }

      onParsed(data as ParseResponse);
    } catch {
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
    </div>
  );
}
