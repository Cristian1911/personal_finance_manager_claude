import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/app/api/_shared/auth";

const PARSER_URL = process.env.PDF_PARSER_URL || "http://localhost:8000";
const PARSER_API_KEY = process.env.PDF_PARSER_API_KEY ?? "";
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const FETCH_TIMEOUT_MS = 60_000; // 60 seconds
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

export async function POST(request: NextRequest) {
  const user = await getRequestUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file || !file.name) {
    return NextResponse.json(
      { error: "No se proporcionó un archivo" },
      { status: 400 }
    );
  }

  const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json(
      { error: "Formato no soportado. Se aceptan PNG, JPG o WEBP." },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "La imagen excede el tamaño máximo de 20MB" },
      { status: 400 }
    );
  }

  if (!PARSER_API_KEY) {
    return NextResponse.json(
      { error: "El servicio de procesamiento no está disponible. Intenta más tarde." },
      { status: 503 }
    );
  }

  const proxyForm = new FormData();
  const fileBuffer = await file.arrayBuffer();
  proxyForm.append("file", new Blob([fileBuffer], { type: file.type }), file.name);

  const screenshotDate = formData.get("screenshot_date") as string | null;
  if (screenshotDate) {
    proxyForm.append("screenshot_date", screenshotDate);
  }

  try {
    const response = await fetch(`${PARSER_URL}/parse-image`, {
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

      if (detail && typeof detail === "object" && detail.type) {
        return NextResponse.json(
          { error: detail.message || "Error procesando la imagen", errorType: detail.type },
          { status: response.status }
        );
      }
      return NextResponse.json(
        { error: (typeof detail === "string" ? detail : null) || "Error procesando la imagen" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "No se pudo conectar con el servicio de procesamiento. Asegúrate de que esté ejecutándose." },
      { status: 503 }
    );
  }
}
