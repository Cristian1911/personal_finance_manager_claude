const PARSER_URL = process.env.PDF_PARSER_URL || "http://localhost:8000";
const PARSER_API_KEY = process.env.PDF_PARSER_API_KEY ?? "";
const PARSE_TIMEOUT_MS = 120_000;

// ── Types ────────────────────────────────────────────────────────────────────

export type ResendAttachment = {
  filename: string;
  content_type: string;
  bytes: Uint8Array;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Filter attachments to PDFs only */
export function filterPdfAttachments(attachments: ResendAttachment[]): ResendAttachment[] {
  return attachments.filter(
    (a) =>
      a.content_type === "application/pdf" ||
      a.filename?.toLowerCase().endsWith(".pdf"),
  );
}

/**
 * Accepted PDF payload types. We accept both raw ArrayBuffers (e.g. from
 * Blob.arrayBuffer()) and Uint8Array views (e.g. Node Buffers) so callers
 * don't have to materialize pool-allocated buffers into fresh ArrayBuffers.
 * Passing `Buffer.from(..).buffer` would include 8KB of shared-pool bytes
 * around small payloads — always prefer the Uint8Array itself.
 */
export type PdfPayload = ArrayBuffer | Uint8Array;

function toUint8(payload: PdfPayload): Uint8Array<ArrayBuffer> {
  // Node Buffer / Uint8Array from attachment decode is always backed by a plain
  // ArrayBuffer, never SharedArrayBuffer, so this cast is safe and avoids a copy.
  if (payload instanceof Uint8Array) {
    return payload as Uint8Array<ArrayBuffer>;
  }
  return new Uint8Array(payload);
}

/** Compute SHA-256 hash of raw PDF content (for idempotency) */
export async function computePdfHash(payload: PdfPayload): Promise<string> {
  const bytes = toUint8(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Detect if a PDF is encrypted by scanning for /Encrypt in the trailer.
 * Checks the last 4KB of the file (where the xref/trailer typically lives)
 * plus the first 2KB (some linearized PDFs put it early).
 */
export function isPdfEncrypted(payload: PdfPayload): boolean {
  const bytes = toUint8(payload);
  const needle = "/Encrypt";

  // Check last 4KB (trailer area)
  const tailStart = Math.max(0, bytes.length - 4096);
  const tail = new TextDecoder("latin1").decode(bytes.slice(tailStart));
  if (tail.includes(needle)) return true;

  // Check first 2KB (linearized PDFs)
  const headEnd = Math.min(bytes.length, 2048);
  const head = new TextDecoder("latin1").decode(bytes.slice(0, headEnd));
  return head.includes(needle);
}


/** Send a PDF buffer to the parser service and return parsed statements */
export async function parsePdfBuffer(params: {
  buffer: PdfPayload;
  filename: string;
  password?: string;
}): Promise<
  | { success: true; statements: unknown[] }
  | { success: false; error: string; needsPassword?: boolean }
> {
  if (!PARSER_API_KEY) {
    return { success: false, error: "Servicio de análisis de PDF no configurado" };
  }

  const formData = new FormData();
  // Convert to Uint8Array so Blob sees only the PDF bytes — not any enclosing
  // pool ArrayBuffer that Node.js may have allocated around a small Buffer.
  formData.append(
    "file",
    new Blob([toUint8(params.buffer)], { type: "application/pdf" }),
    params.filename,
  );
  if (params.password) {
    formData.append("password", params.password);
  }

  try {
    const response = await fetch(`${PARSER_URL}/parse`, {
      method: "POST",
      headers: { "X-Parser-Key": PARSER_API_KEY },
      body: formData,
      signal: AbortSignal.timeout(PARSE_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({ detail: "Error del parser" }));
      const detail = body.detail;

      // Check for password-required error
      if (
        response.status === 422 &&
        typeof detail === "object" &&
        detail?.type === "password_required"
      ) {
        return {
          success: false,
          error: "PDF protegido: la contraseña falta o es incorrecta",
          needsPassword: true,
        };
      }

      // The parser returns errors as {message, type} objects — surface the
      // real message instead of a generic fallback.
      const message =
        typeof detail === "string"
          ? detail
          : typeof detail?.message === "string"
            ? detail.message
            : "Error procesando el PDF";
      return { success: false, error: message };
    }

    const data = await response.json();
    return { success: true, statements: data.statements ?? [] };
  } catch {
    return { success: false, error: "No se pudo conectar con el parser" };
  }
}

