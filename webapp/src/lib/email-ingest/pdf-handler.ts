const PARSER_URL = process.env.PDF_PARSER_URL || "http://localhost:8000";
const PARSER_API_KEY = process.env.PDF_PARSER_API_KEY ?? "";
const PARSE_TIMEOUT_MS = 120_000;

// ── Types ────────────────────────────────────────────────────────────────────

export type ResendAttachment = {
  filename: string;
  content_type: string;
  content: string; // base64-encoded
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

/** Compute SHA-256 hash of raw PDF content (for idempotency) */
export async function computePdfHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Validate PDF magic bytes (%PDF) */
function isPdfContent(buffer: ArrayBuffer): boolean {
  if (buffer.byteLength < 4) return false;
  const header = new Uint8Array(buffer, 0, 4);
  return header[0] === 0x25 && header[1] === 0x50 && header[2] === 0x44 && header[3] === 0x46;
}

/**
 * Detect if a PDF is encrypted by scanning for /Encrypt in the trailer.
 * Checks the last 4KB of the file (where the xref/trailer typically lives)
 * plus the first 2KB (some linearized PDFs put it early).
 */
export function isPdfEncrypted(buffer: ArrayBuffer): boolean {
  const bytes = new Uint8Array(buffer);
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
  buffer: ArrayBuffer;
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
  formData.append(
    "file",
    new Blob([params.buffer], { type: "application/pdf" }),
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
        return { success: false, error: "PDF protegido con contraseña", needsPassword: true };
      }

      const message = typeof detail === "string" ? detail : "Error procesando el PDF";
      return { success: false, error: message };
    }

    const data = await response.json();
    return { success: true, statements: data.statements ?? [] };
  } catch {
    return { success: false, error: "No se pudo conectar con el parser" };
  }
}

