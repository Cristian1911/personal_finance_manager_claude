import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/app/api/_shared/auth";

const PARSER_URL = process.env.PDF_PARSER_URL || "http://localhost:8000";
const PARSER_API_KEY = process.env.PDF_PARSER_API_KEY ?? process.env.PARSER_API_KEY ?? "";

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
