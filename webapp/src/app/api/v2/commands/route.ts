import { NextResponse } from "next/server";
import { applyCommand, createSqlStorage, type CommandEnvelope, type CommandResult } from "@zeta/shared";
import { createUserScopedPgDriver } from "@/lib/engine/pg-driver";
import { v2Config, v2Pool, v2User } from "@/lib/engine/v2-server";

const SERVER_ONLY = new Set<string>(["captureBankTransaction"]);

const MAX_BATCH = 100;
const MAX_BODY_BYTES = 1_000_000;

/**
 * The phone's outbox, drained (S9-4): each command is replayed, in order,
 * with the same engine against Postgres as the signed-in user. Replays are
 * no-ops (command id). A command that throws stops the batch; the phone
 * retries from it. Rejections are answers, not failures.
 */
export async function POST(request: Request) {
  const cfg = v2Config();
  if (!cfg) return NextResponse.json({ error: "v2 no está configurado" }, { status: 503 });
  const user = await v2User(request, cfg);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Solicitud muy grande" }, { status: 413 });
  }
  let commands: CommandEnvelope[];
  try {
    const body = (await request.json()) as { commands?: unknown };
    if (!Array.isArray(body.commands) || body.commands.length === 0 || body.commands.length > MAX_BATCH) throw new Error();
    commands = body.commands as CommandEnvelope[];
  } catch {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }
  // A token can only write its own data.
  if (commands.some((c) => !c || c.userId !== user.id)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  // Bank facts come only from the server (emails, statements): a phone can't forge a tier-2 row.
  if (commands.some((c) => SERVER_ONLY.has(c.type))) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const storage = createSqlStorage(createUserScopedPgDriver(v2Pool(cfg.databaseUrl), user.id));
  const results: { id: string; result: CommandResult }[] = [];
  for (const c of commands) {
    try {
      const result = await applyCommand(storage, c);
      // A command this server doesn't know yet (the app is newer than the deploy): not
      // applied, not recorded — stop here so the phone keeps it queued instead of dropping it.
      if (result.status === "rejected" && result.code === "unsupported") {
        return NextResponse.json({ results, failed: { id: c.id, error: "El servidor aún no conoce este cambio" } });
      }
      results.push({ id: c.id, result });
    } catch (e) {
      console.error("[v2 commands] apply failed", { id: c.id, type: c.type, error: e instanceof Error ? e.message : String(e) });
      return NextResponse.json({ results, failed: { id: c.id, error: "No se pudo aplicar" } });
    }
  }
  return NextResponse.json({ results });
}
