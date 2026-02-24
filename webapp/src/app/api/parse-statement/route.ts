import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const PARSER_URL = process.env.PDF_PARSER_URL || "http://localhost:8000";
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  // Support Bearer token auth (mobile) and cookie auth (web)
  const authHeader = request.headers.get("authorization");
  let user;

  if (authHeader?.startsWith("Bearer ")) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser(authHeader.slice(7));
    if (error || !data.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    user = data.user;
  } else {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    user = data.user;
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

  try {
    const response = await fetch(`${PARSER_URL}/parse`, {
      method: "POST",
      body: proxyForm,
    });

    if (!response.ok) {
      const body = await response
        .json()
        .catch(() => ({ detail: "Error del parser" }));
      const detail = body.detail;
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
