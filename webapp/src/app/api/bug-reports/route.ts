import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_ATTACHMENT_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function sanitizeFilename(name: string): string {
  const safe = name.replace(/[^a-zA-Z0-9_.-]/g, "-");
  return safe.slice(0, 120) || "attachment";
}

function parseOptionalString(
  formData: FormData,
  key: string,
  maxLength: number
): string | null {
  const value = formData.get(key);
  if (typeof value !== "string") return null;
  const trimmed = value.trim().slice(0, maxLength);
  return trimmed.length > 0 ? trimmed : null;
}

function parseDeviceContext(formData: FormData): Json {
  const raw = formData.get("device_context");
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    return parsed as Json;
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const formData = await request.formData();

  const titleRaw = formData.get("title");
  const descriptionRaw = formData.get("description");

  const title = typeof titleRaw === "string" ? titleRaw.trim().slice(0, 160) : "";
  const description =
    typeof descriptionRaw === "string" ? descriptionRaw.trim().slice(0, 4000) : "";

  if (title.length < 4) {
    return NextResponse.json(
      { error: "El título debe tener al menos 4 caracteres." },
      { status: 400 }
    );
  }

  if (description.length < 9) {
    return NextResponse.json(
      { error: "La descripción debe tener al menos 9 caracteres." },
      { status: 400 }
    );
  }

  const sourceRaw = formData.get("source");
  const source =
    typeof sourceRaw === "string" && sourceRaw.trim().length > 0
      ? sourceRaw.trim().slice(0, 32)
      : "web";

  const routeHint = parseOptionalString(formData, "route_hint", 300);
  const selectedAreaHint = parseOptionalString(formData, "selected_area_hint", 500);
  const deviceContext = parseDeviceContext(formData);

  const attachment = formData.get("attachment");
  let attachmentPath: string | null = null;

  if (attachment instanceof File && attachment.size > 0) {
    if (attachment.size > MAX_ATTACHMENT_SIZE_BYTES) {
      return NextResponse.json(
        { error: "El archivo adjunto excede el máximo de 10MB." },
        { status: 400 }
      );
    }

    if (!ALLOWED_ATTACHMENT_MIME_TYPES.has(attachment.type)) {
      return NextResponse.json(
        {
          error:
            "Tipo de archivo no soportado. Usa JPG, PNG, WEBP o PDF.",
        },
        { status: 400 }
      );
    }

    const safeName = sanitizeFilename(attachment.name || "attachment");
    attachmentPath = `${user.id}/${Date.now()}-${safeName}`;

    const attachmentBytes = new Uint8Array(await attachment.arrayBuffer());
    const { error: uploadError } = await supabase.storage
      .from("bug-reports")
      .upload(attachmentPath, attachmentBytes, {
        contentType: attachment.type,
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: `No se pudo subir el adjunto: ${uploadError.message}` },
        { status: 500 }
      );
    }
  }

  const { data: inserted, error: insertError } = await supabase
    .from("bug_reports")
    .insert({
      user_id: user.id,
      source,
      status: "OPEN",
      title,
      description,
      route_hint: routeHint,
      selected_area_hint: selectedAreaHint,
      attachment_path: attachmentPath,
      device_context: deviceContext,
    })
    .select("id")
    .single();

  if (insertError) {
    if (attachmentPath) {
      await supabase.storage.from("bug-reports").remove([attachmentPath]);
    }
    return NextResponse.json(
      { error: `No se pudo crear el ticket: ${insertError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ id: inserted.id });
}
