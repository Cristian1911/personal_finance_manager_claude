import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { toDialect } from "@zeta/shared";
import { createUserScopedPgDriver } from "@/lib/engine/pg-driver";
import { v2Config, v2Pool, v2User } from "@/lib/engine/v2-server";

/**
 * Ajustes › Correos del banco: the user's forwarding address (created the
 * first time) and Gmail's confirmation link once it arrives.
 */
export async function GET(request: Request) {
  const cfg = v2Config();
  if (!cfg) return NextResponse.json({ error: "v2 no está configurado" }, { status: 503 });
  const user = await v2User(request, cfg);
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const domain = process.env.NEXT_PUBLIC_EMAIL_INGEST_DOMAIN;
  if (!domain) return NextResponse.json({ error: "Falta el dominio de correo" }, { status: 503 });

  const driver = createUserScopedPgDriver(v2Pool(cfg.databaseUrl), user.id);
  const row = await driver.transaction(async (tx) => {
    const sel = toDialect("SELECT address_key, gmail_verification_url FROM email_ingest_addresses WHERE user_id = ? AND is_active = ? LIMIT 1", "postgres");
    const found = await tx.query<{ address_key: string; gmail_verification_url: string | null }>(sel, [user.id, true]);
    if (found[0]) return found[0];
    // Like the web app's: u_ + 8 lowercase characters.
    const key = `u_${randomBytes(6).toString("base64url").slice(0, 8)}`.toLowerCase();
    await tx.query(toDialect("INSERT INTO email_ingest_addresses (user_id, address_key, is_active, auto_import) VALUES (?, ?, ?, ?)", "postgres"),
      [user.id, key, true, true]);
    return { address_key: key, gmail_verification_url: null };
  });
  return NextResponse.json(
    { address: `${row.address_key}@${domain}`, gmailVerificationUrl: row.gmail_verification_url },
    { headers: { "Cache-Control": "no-store" } },
  );
}
