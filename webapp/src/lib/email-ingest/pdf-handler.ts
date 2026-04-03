import { createAdminClient } from "@/lib/supabase/admin";

const PARSER_URL = process.env.PDF_PARSER_URL || "http://localhost:8000";
const PARSER_API_KEY = process.env.PDF_PARSER_API_KEY ?? "";
const PARSE_TIMEOUT_MS = 120_000;

// ── Types ────────────────────────────────────────────────────────────────────

export type ResendAttachment = {
  filename: string;
  content_type: string;
  content: string; // base64-encoded
};

export type PdfExtractionResult =
  | {
      filename: string;
      contentHash: string;
      storagePath: string;
      fileSizeBytes: number;
      parsed: true;
      statements: unknown[]; // ParsedStatement[] from parser
    }
  | {
      filename: string;
      contentHash: string;
      storagePath: string;
      fileSizeBytes: number;
      parsed: false;
      error: string;
      needsPassword?: boolean;
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

// ── Core functions ───────────────────────────────────────────────────────────

/** Store a PDF in Supabase Storage under the user's folder */
export async function storePdf(params: {
  userId: string;
  filename: string;
  buffer: ArrayBuffer;
}): Promise<{ storagePath: string } | { error: string }> {
  const admin = createAdminClient();
  const timestamp = Date.now();
  const safeName = params.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${params.userId}/${timestamp}-${safeName}`;

  const { error } = await admin.storage
    .from("email-pdfs")
    .upload(storagePath, params.buffer, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) return { error: error.message };
  return { storagePath };
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
    return { success: false, error: "PDF parser service not configured" };
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

/**
 * Process a single PDF attachment: validate, hash, store, parse.
 * Returns the result for inserting into pending_email_statements.
 */
export async function processEmailPdfAttachment(params: {
  attachment: ResendAttachment;
  userId: string;
  password?: string;
}): Promise<PdfExtractionResult> {
  const { attachment, userId, password } = params;
  const filename = attachment.filename || "attachment.pdf";

  // Decode base64 to buffer
  const binaryString = atob(attachment.content);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  const buffer = bytes.buffer;

  // Validate PDF magic bytes
  if (!isPdfContent(buffer)) {
    return {
      filename,
      contentHash: "",
      storagePath: "",
      fileSizeBytes: buffer.byteLength,
      parsed: false,
      error: "El archivo no es un PDF válido",
    };
  }

  // Compute content hash for idempotency
  const contentHash = await computePdfHash(buffer);

  // Store in Supabase Storage
  const storeResult = await storePdf({ userId, filename, buffer });
  if ("error" in storeResult) {
    return {
      filename,
      contentHash,
      storagePath: "",
      fileSizeBytes: buffer.byteLength,
      parsed: false,
      error: `Error almacenando PDF: ${storeResult.error}`,
    };
  }

  // Parse with the PDF parser service
  const parseResult = await parsePdfBuffer({ buffer, filename, password });
  if (!parseResult.success) {
    return {
      filename,
      contentHash,
      storagePath: storeResult.storagePath,
      fileSizeBytes: buffer.byteLength,
      parsed: false,
      error: parseResult.error,
      needsPassword: parseResult.needsPassword,
    };
  }

  return {
    filename,
    contentHash,
    storagePath: storeResult.storagePath,
    fileSizeBytes: buffer.byteLength,
    parsed: true,
    statements: parseResult.statements,
  };
}
