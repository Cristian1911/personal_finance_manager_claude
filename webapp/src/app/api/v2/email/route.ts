import { NextResponse } from "next/server";
import { processV2Email } from "@/lib/engine/v2-email";
import { v2Config, v2Pool } from "@/lib/engine/v2-server";

/**
 * Resend's inbound webhook for Zeta v2 forwarding addresses (S9-3). Signed
 * like the web app's (Svix); answers 200 for anything it won't process so
 * Resend doesn't retry it forever.
 */
export async function POST(request: Request) {
  const cfg = v2Config();
  if (!cfg) return NextResponse.json({ error: "v2 no está configurado" }, { status: 503 });
  const raw = await request.text();
  if (!(await verifySvix(request, raw))) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  let event: { type?: string; data?: { email_id: string; from: string; to: string[]; created_at?: string } };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }
  if (event.type !== "email.received" || !event.data?.email_id) return NextResponse.json({ ok: true });
  const { email_id: emailId, from, to } = event.data;
  const content = await fetchContent(emailId);
  if (!content) return NextResponse.json({ error: "No se pudo leer el correo" }, { status: 502 }); // Resend retries
  const { outcome } = await processV2Email(v2Pool(cfg.databaseUrl), { emailId, from, to, ...content });
  if (outcome !== "no_address") console.log(`[v2 email][${emailId}] ${outcome}`);
  return NextResponse.json({ ok: true });
}

// ponytail: copies of the web app's Resend helpers (email-ingest route); share them when that route is retired.
async function verifySvix(request: Request, body: string): Promise<boolean> {
  const secret = process.env.RESEND_WEBHOOK_SECRET_V2 || process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const id = request.headers.get("svix-id");
  const ts = request.headers.get("svix-timestamp");
  const sigs = request.headers.get("svix-signature");
  if (!id || !ts || !sigs) return false;
  const bytes = Uint8Array.from(atob(secret.startsWith("whsec_") ? secret.slice(6) : secret), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`));
  const expected = "v1," + btoa(String.fromCharCode(...new Uint8Array(mac)));
  return sigs.split(" ").some((s) => s === expected);
}

async function fetchContent(emailId: string): Promise<{ text: string | null; html: string | null } | null> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}`, { headers: { Authorization: `Bearer ${apiKey}` } });
  if (!res.ok) return null;
  const data = await res.json();
  return { text: data.text ?? null, html: data.html ?? null };
}
