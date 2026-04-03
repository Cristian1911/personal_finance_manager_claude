import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/app/api/_shared/auth";
import { createClient } from "@/lib/supabase/server";
import { isPdfEncrypted } from "@/lib/email-ingest/pdf-handler";
import { parseStatementFilename, matchAccountByLast4 } from "@/lib/email-ingest/statement-filename";

const PARSER_URL = process.env.PDF_PARSER_URL || "http://localhost:8000";
const PARSER_API_KEY = process.env.PDF_PARSER_API_KEY ?? "";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT_MS = 120_000; // 120 seconds (PDF parsing can be slow)

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json(
      { error: "El archivo debe ser un PDF" },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "El archivo excede el tamaño máximo de 10MB" },
      { status: 400 }
    );
  }

  let password = formData.get("password") as string | null;
  const userProvidedPassword = !!password;

  // Auto-fill password from account if filename matches
  const filenameInfo = parseStatementFilename(file.name);
  if (!password && filenameInfo) {
    const supabase = await createClient();
    const { data: accounts } = await supabase
      .from("accounts")
      .select("id, mask, pdf_password")
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (accounts) {
      const match = matchAccountByLast4(accounts, filenameInfo.last4);
      if (match?.pdfPassword) {
        password = match.pdfPassword;
      }
    }
  }

  // Quick encryption check — fail fast instead of waiting for the parser
  const fileBuffer = await file.arrayBuffer();
  if (isPdfEncrypted(fileBuffer) && !password) {
    return NextResponse.json(
      {
        error: "El PDF está protegido con contraseña. Ingresa la contraseña para procesarlo.",
        errorType: "password_required",
      },
      { status: 422 }
    );
  }

  const proxyForm = new FormData();
  proxyForm.append("file", new Blob([fileBuffer], { type: "application/pdf" }), file.name);
  if (password) {
    proxyForm.append("password", password);
  }

  if (!PARSER_API_KEY) {
    return NextResponse.json(
      {
        error:
          "El servicio de procesamiento de PDFs no está disponible. Intenta más tarde.",
      },
      { status: 503 }
    );
  }

  try {
    const response = await fetch(`${PARSER_URL}/parse`, {
      method: "POST",
      headers: { "X-Parser-Key": PARSER_API_KEY },
      body: proxyForm,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response
        .json()
        .catch(() => ({ detail: "Error del parser" }));
      const detail = body.detail;

      // Map raw server-config errors to user-friendly messages
      if (
        response.status === 503 &&
        typeof detail === "string" &&
        detail.toLowerCase().includes("not configured")
      ) {
        return NextResponse.json(
          {
            error:
              "El servicio de procesamiento de PDFs no está disponible. Intenta más tarde.",
          },
          { status: 503 }
        );
      }

      if (detail && typeof detail === "object" && detail.type) {
        return NextResponse.json(
          { error: detail.message || "Error procesando el PDF", errorType: detail.type },
          { status: response.status }
        );
      }
      return NextResponse.json(
        { error: (typeof detail === "string" ? detail : null) || "Error procesando el PDF" },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Save password on matched account for future auto-parsing
    if (userProvidedPassword && password && filenameInfo) {
      try {
        const supabase = await createClient();
        const { data: accounts } = await supabase
          .from("accounts")
          .select("id, mask, pdf_password")
          .eq("user_id", user.id)
          .eq("is_active", true);

        if (accounts) {
          const match = matchAccountByLast4(accounts, filenameInfo.last4);
          if (match) {
            await supabase
              .from("accounts")
              .update({ pdf_password: password })
              .eq("id", match.accountId)
              .eq("user_id", user.id);
          }
        }
      } catch {
        // Non-fatal — password save failure shouldn't block the parse result
      }
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      {
        error:
          "No se pudo conectar con el servicio de procesamiento de PDFs. Asegúrate de que esté ejecutándose.",
      },
      { status: 503 }
    );
  }
}
