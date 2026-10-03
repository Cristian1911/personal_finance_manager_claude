import { NextResponse } from "next/server";
import { readSnapshot } from "@zeta/shared";
import { getExchangeRate } from "@/actions/exchange-rate";
import { createUserScopedPgDriver } from "@/lib/engine/pg-driver";
import { v2Config, v2Pool, v2User } from "@/lib/engine/v2-server";

/**
 * The user's own rows for the phone (S9-4 pull): everything, and dated
 * tables from `since` (YYYY-MM-DD). Read as the user, through the views.
 * Also today's dollar (S10-14), which isn't the user's data.
 */
export async function GET(request: Request) {
  const cfg = v2Config();
  if (!cfg) return NextResponse.json({ error: "v2 no está configurado" }, { status: 503 });
  const user = await v2User(request, cfg);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const since = new URL(request.url).searchParams.get("since") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) return NextResponse.json({ error: "Fecha inválida" }, { status: 400 });

  // One transaction: a consistent copy, even if another device pushes meanwhile.
  const snapshot = await createUserScopedPgDriver(v2Pool(cfg.databaseUrl), user.id)
    .transaction((tx) => readSnapshot(tx, user.id, since));
  // The dollar for a card's USD section (S10-14): the web's shared rate (cached, refreshed hourly). A missing
  // rate never fails the pull; the phone keeps its last one and shows dollars without pesos meanwhile.
  const usd = await getExchangeRate("USD", "COP").catch(() => null);
  const rates = usd ? { USD_COP: { rate: usd.rate, at: usd.fetchedAt } } : {};
  return NextResponse.json({ snapshot, rates }, { headers: { "Cache-Control": "no-store" } });
}
