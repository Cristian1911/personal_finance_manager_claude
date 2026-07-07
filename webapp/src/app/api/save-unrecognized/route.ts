import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/app/api/_shared/auth";

const PARSER_URL = process.env.PDF_PARSER_URL || "http://localhost:8000";
const PARSER_API_KEY = process.env.PDF_PARSER_API_KEY ?? "";
const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10 MB — same limit as /api/parse-statement
const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20 MB — same limit as /api/parse-image
const FETCH_TIMEOUT_MS = 30_000; // 30 seconds
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

export async function POST(request: NextRequest) {
  if (!(await getRequestUser(request))) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const name = file?.name.toLowerCase() ?? "";
  const isPdf = name.endsWith(".pdf");
  const isImage = IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext));

  if (!file || (!isPdf && !isImage)) {
    return NextResponse.json(
      { error: "Formato no soportado. Se aceptan PDF, PNG, JPG o WEBP." },
      { status: 400 }
    );
  }

  const maxSize = isPdf ? MAX_PDF_SIZE : MAX_IMAGE_SIZE;
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: `El archivo excede el tamaño máximo de ${maxSize / (1024 * 1024)}MB` },
      { status: 400 }
    );
  }

  const proxyForm = new FormData();
  proxyForm.append("file", file);

  if (!PARSER_API_KEY) {
    return NextResponse.json(
      { error: "No se pudo conectar con el servicio de procesamiento de PDFs." },
      { status: 503 }
    );
  }

  try {
    const response = await fetch(`${PARSER_URL}/save-unrecognized`, {
      method: "POST",
      headers: { "X-Parser-Key": PARSER_API_KEY },
      body: proxyForm,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "No se pudo guardar el archivo" },
        { status: response.status }
      );
    }

    return NextResponse.json({ saved: true });
  } catch {
    return NextResponse.json(
      { error: "No se pudo conectar con el servicio de procesamiento de PDFs." },
      { status: 503 }
    );
  }
}
