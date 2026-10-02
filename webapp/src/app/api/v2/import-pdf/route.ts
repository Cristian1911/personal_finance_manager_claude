import { NextResponse } from "next/server";
import { isPdfEncrypted } from "@/lib/email-ingest/pdf-handler";
import { importStatements, planStatements, type StatementChoice } from "@/lib/engine/v2-statement";
import { v2Config, v2Pool, v2User } from "@/lib/engine/v2-server";
import type { ParseResponse } from "@/types/import";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const PARSER_URL = process.env.PDF_PARSER_URL || "http://localhost:8000";

/**
 * Subir un extracto (S9-3): the phone sends the PDF; the parser reads it.
 * Without `choices`, a statement whose account isn't known comes back as a
 * question (D1: create it, pick one, or skip) and nothing is imported; with
 * them, every row becomes a command and the phone pulls the result.
 */
export async function POST(request: Request) {
  const cfg = v2Config();
  if (!cfg) return NextResponse.json({ error: "v2 no está configurado" }, { status: 503 });
  const user = await v2User(request, cfg);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) return NextResponse.json({ error: "Falta el PDF." }, { status: 400 });
  if (file.size > MAX_FILE_SIZE) return NextResponse.json({ error: "El PDF pesa más de 10 MB." }, { status: 400 });
  const password = (form.get("password") as string | null) || null;
  let choices: StatementChoice[] | null = null;
  const rawChoices = form.get("choices");
  if (typeof rawChoices === "string") {
    try { choices = JSON.parse(rawChoices); } catch { return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 }); }
    if (!Array.isArray(choices)) return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isPdfEncrypted(bytes) && !password) {
    return NextResponse.json({ error: "Este PDF tiene contraseña.", errorType: "password_required" }, { status: 422 });
  }
  const parserKey = process.env.PDF_PARSER_API_KEY;
  if (!parserKey) return NextResponse.json({ error: "Leer extractos no está disponible ahora. Intenta más tarde." }, { status: 503 });
  const proxy = new FormData();
  proxy.append("file", new Blob([bytes], { type: "application/pdf" }), (file as File).name || "extracto.pdf");
  if (password) proxy.append("password", password);
  let res: Response;
  try {
    res = await fetch(`${PARSER_URL}/parse`, { method: "POST", headers: { "X-Parser-Key": parserKey }, body: proxy, signal: AbortSignal.timeout(120_000) });
  } catch {
    return NextResponse.json({ error: "No pudimos leer el extracto ahora. Intenta más tarde." }, { status: 503 });
  }
  if (!res.ok) {
    const detail = (await res.json().catch(() => ({}))).detail;
    // The parser's errors are {message, type} objects (never plain strings): see the PDF parser notes.
    if (detail && typeof detail === "object" && detail.type) {
      return NextResponse.json({ error: detail.message || "No pudimos leer este PDF.", errorType: detail.type }, { status: res.status });
    }
    return NextResponse.json({ error: "No pudimos leer este PDF." }, { status: res.status >= 500 ? 502 : 422 });
  }
  const { statements } = (await res.json()) as ParseResponse;
  if (!statements?.length) return NextResponse.json({ error: "No encontramos movimientos en este PDF." }, { status: 422 });

  const pool = v2Pool(cfg.databaseUrl);
  const plans = await planStatements(pool, user.id, statements);
  if (!choices && plans.some((p) => !p.accountId && p.suggested)) {
    return NextResponse.json({ needs: plans }, { headers: { "Cache-Control": "no-store" } });
  }
  const results = await importStatements(pool, user.id, statements, choices ?? []);
  return NextResponse.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
