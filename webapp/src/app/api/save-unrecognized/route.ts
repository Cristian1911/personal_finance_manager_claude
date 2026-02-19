import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PARSER_URL = process.env.PDF_PARSER_URL || "http://localhost:8000";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const proxyForm = new FormData();
  proxyForm.append("file", file);

  try {
    const response = await fetch(`${PARSER_URL}/save-unrecognized`, {
      method: "POST",
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
