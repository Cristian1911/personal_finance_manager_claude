import { NextResponse } from "next/server";
import { readSnapshot } from "@zeta/shared";
import { createUserScopedPgDriver } from "@/lib/engine/pg-driver";
import { v2Config, v2Pool, v2User } from "@/lib/engine/v2-server";

/**
 * The user's own rows for the phone (S9-4 pull): everything, and dated
 * tables from `since` (YYYY-MM-DD). Read as the user, through the views.
 */
export async function GET(request: Request) {
  const cfg = v2Config();
  if (!cfg) return NextResponse.json({ error: "v2 no está configurado" }, { status: 503 });
  const user = await v2User(request, cfg);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const since = new URL(request.url).searchParams.get("since") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });

  const snapshot = await readSnapshot(createUserScopedPgDriver(v2Pool(cfg.databaseUrl), user.id), user.id, since);
  return NextResponse.json({ snapshot }, { headers: { "Cache-Control": "no-store" } });
}
