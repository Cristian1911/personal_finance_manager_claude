import "server-only";
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { applyCommand, createSqlStorage, toDialect, type CommandResult } from "@zeta/shared";
import { parseBancolombiaEmail } from "@/lib/parsers/bancolombia-email";
import { resolveSuggestedEmailAccountId } from "@/lib/email-ingest/account-matching";
import { resolveEmailTransactionCurrency } from "@/lib/email-ingest/currency";
import { normalizeEmailTime } from "@/lib/email-ingest/time";
import type { AccountType, CurrencyCode } from "@/types/domain";
import { createUserScopedPgDriver } from "./pg-driver";

/** Same senders the web app accepts (email-ingest route). */
const BANK_SENDERS = [
  "alertasynotificaciones@an.notificacionesbancolombia.com",
  "extractosbancolombia@extractos.documentosbancolombia.com",
];

export type V2EmailOutcome =
  | "no_address" | "gmail_verification" | "sender_rejected" | "not_a_movement" | "rate_limited"
  | "unknown_account" | "applied" | "duplicate" | "rejected";

/** Same daily cap per user as the web app. */
const PER_DAY = 100;
/** v1's log statuses, so the parse_failed corpus replay (template drift) covers v2 too. */
const LOG_STATUS: Partial<Record<V2EmailOutcome, string>> = {
  applied: "imported", duplicate: "duplicate", sender_rejected: "sender_rejected", rate_limited: "rate_limited",
  not_a_movement: "parse_failed", unknown_account: "parse_failed", rejected: "parse_failed",
};

/** A stable UUID from text: Resend redelivers the same email id, which must land on the same movement. */
function uuidFrom(text: string): string {
  const h = createHash("sha256").update(text).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

function stripHtml(html: string): string {
  return html.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#\d+;/g, "").replace(/\s+/g, " ").trim();
}

/**
 * One forwarded email into Zeta v2 (S9-3): the address says whose it is; a
 * Bancolombia alert becomes a captureBankTransaction for the account with its
 * last 4 — the same command, conflicts and dedup as everything else.
 */
export async function processV2Email(pool: Pool, email: {
  emailId: string; from: string; to: string[]; text: string | null; html: string | null; receivedAt?: string;
}): Promise<{ outcome: V2EmailOutcome; result?: CommandResult }> {
  const key = (email.to?.[0] ?? "").split("@")[0]?.toLowerCase();
  if (!key) return { outcome: "no_address" };
  // address_key and user_id are plain columns: no decryption needed to route it.
  const { rows } = await pool.query<{ id: string; user_id: string; account_id: string | null }>(
    "SELECT id, user_id, account_id FROM email_ingest_addresses_enc WHERE lower(address_key) = $1 AND is_active LIMIT 1", [key]);
  const address = rows[0];
  // Not a v2 address (the web app's, or unknown): not ours to log.
  if (!address) return { outcome: "no_address" };
  const userId = address.user_id;
  const log = async (outcome: V2EmailOutcome, error: string | null = null) => {
    const status = LOG_STATUS[outcome];
    if (!status) return;
    await pool.query(
      "INSERT INTO email_ingest_logs (user_id, email_ingest_id, from_address, status, raw_body, error_message) VALUES ($1, $2, $3, $4, $5, $6)",
      [userId, address.id, email.from.slice(0, 300), status, body.slice(0, 800) || null, error],
    ).catch((e: Error) => console.error("[v2 email] log failed", e.message));
  };
  const driver = createUserScopedPgDriver(pool, userId);
  const body = email.text || (email.html ? stripHtml(email.html) : "");
  const from = (email.from.toLowerCase().match(/<([^>]+)>/)?.[1] ?? email.from.toLowerCase()).trim();

  // Gmail's "confirm forwarding" email: keep its link for Ajustes › Correos del banco.
  if (from.includes("forwarding-noreply@google.com")) {
    const link = `${body} ${email.html ?? ""}`.match(/https:\/\/mail\.google\.com\/mail\/vf-[^\s"<>]+/)?.[0];
    if (link) {
      await driver.query(toDialect("UPDATE email_ingest_addresses SET gmail_verification_url = ?, gmail_verification_at = now() WHERE user_id = ? AND id = ?", "postgres"),
        [link, userId, address.id]);
    }
    return { outcome: "gmail_verification" };
  }
  if (!BANK_SENDERS.includes(from)) {
    await log("sender_rejected", `Remitente no permitido: ${from}`);
    return { outcome: "sender_rejected" };
  }
  const { rows: [today] } = await pool.query<{ n: string }>(
    "SELECT count(*) AS n FROM email_ingest_logs WHERE user_id = $1 AND created_at >= date_trunc('day', now())", [userId]);
  if (Number(today.n) >= PER_DAY) {
    await log("rate_limited");
    return { outcome: "rate_limited" };
  }

  const parsed = body.trim() ? parseBancolombiaEmail(body) : null;
  if (!parsed) {
    await log("not_a_movement", "No es una alerta de movimiento reconocida");
    return { outcome: "not_a_movement" };
  }
  // A bank alert came through: forwarding works, Gmail's confirmation link is no longer needed.
  await driver.query(toDialect("UPDATE email_ingest_addresses SET gmail_verification_url = NULL WHERE user_id = ? AND id = ? AND gmail_verification_url IS NOT NULL", "postgres"),
    [userId, address.id]);

  const accounts = await driver.query<{ id: string; account_type: AccountType; mask: string | null; debit_card_mask: string | null; currency_code: CurrencyCode }>(
    toDialect("SELECT id, account_type, mask, debit_card_mask, currency_code FROM accounts WHERE user_id = ? AND is_active = ?", "postgres"), [userId, true]);
  // v2 asks for one "últimos 4" per account: on a savings account it stands for the debit card too (D18).
  const candidates = accounts.map((a) => ({ ...a, debit_card_mask: a.debit_card_mask ?? a.mask }));
  const accountId = resolveSuggestedEmailAccountId({ accounts: candidates, parsed, defaultAccountId: address.account_id });
  // ponytail: an unknown card's movement isn't captured yet; D1 wants a Revisar card (add / assign).
  if (!accountId) {
    await log("unknown_account", `Sin cuenta para ${parsed.card_type} *${parsed.card_last4}`);
    return { outcome: "unknown_account" };
  }
  const account = accounts.find((a) => a.id === accountId)!;

  const description = parsed.merchant ?? parsed.destination ?? parsed.raw_line;
  const result = await applyCommand(createSqlStorage(driver), {
    id: uuidFrom(`email-command:${email.emailId}`),
    type: "captureBankTransaction",
    userId,
    deviceId: "email",
    clientTs: email.receivedAt ?? new Date().toISOString(),
    payload: {
      transactionId: uuidFrom(`email:${email.emailId}`),
      accountId,
      source: "EMAIL",
      amount: parsed.amount,
      direction: parsed.direction,
      currencyCode: resolveEmailTransactionCurrency(parsed, account.currency_code),
      date: parsed.transaction_date,
      time: normalizeEmailTime(parsed.transaction_time)?.slice(0, 5) ?? null,
      rawLine: parsed.raw_line,
      description: description.slice(0, 200),
      merchantName: parsed.merchant,
      sourcePattern: parsed.pattern_type,
    },
  });
  // A redelivery replays the stored answer: nothing was applied twice.
  const outcome = result.status === "duplicate" || result.replayed ? "duplicate" : result.status === "applied" ? "applied" : "rejected";
  await log(outcome, result.status === "rejected" ? (result.error ?? "Rechazado") : null);
  return { outcome, result };
}
