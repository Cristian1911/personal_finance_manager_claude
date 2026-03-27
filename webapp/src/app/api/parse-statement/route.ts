import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/app/api/_shared/auth";

const PARSER_URL = process.env.PDF_PARSER_URL || "http://localhost:8000";
const PARSER_API_KEY = process.env.PDF_PARSER_API_KEY ?? "";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const FETCH_TIMEOUT_MS = 120_000; // 120 seconds (PDF parsing can be slow)

export async function POST(request: NextRequest) {
  if (!(await getRequestUser(request))) {
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

  const password = formData.get("password") as string | null;

  const proxyForm = new FormData();
  proxyForm.append("file", file);
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
