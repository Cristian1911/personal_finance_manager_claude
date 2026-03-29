import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMessage, verifySecretToken } from "@/lib/telegram";
import { parseVoiceCapture } from "@/actions/voice-capture";
import { autoCategorize } from "@zeta/shared";
import { computeIdempotencyKey } from "@/lib/utils/idempotency";
import { formatCurrency } from "@/lib/utils/currency";
import type { CurrencyCode } from "@/types/domain";

// ── Telegram types (minimal) ────────────────────────────────────────────────

type TelegramUpdate = {
  message?: {
    message_id: number;
    chat: { id: number };
    from?: { id: number; first_name?: string };
    text?: string;
  };
};

// ── Link storage: telegram_chat_id → capture_token mapping ──────────────────
// We store this in the capture_tokens.label field as "telegram:<chat_id>"
// so no new table is needed.

async function findTokenByChatId(chatId: number) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("capture_tokens")
    .select("id, user_id, token, default_account_id, label")
    .like("label", `telegram:${chatId}%`)
    .is("revoked_at", null)
    .limit(1)
    .single();

  return data;
}

// ── Commands ────────────────────────────────────────────────────────────────

const HELP_TEXT = `<b>Zeta — Captura rápida</b>

Envíame un mensaje con tu gasto o ingreso y lo registro automáticamente.

<b>Ejemplos:</b>
• <i>Gasté 15k en café</i>
• <i>Me pagaron 500 mil</i>
• <i>Uber 8 mil ayer</i>
• <i>Almuerzo 25 mil</i>

<b>Comandos:</b>
/vincular &lt;token&gt; — Vincular tu cuenta Zeta
/cuenta — Ver tu cuenta actual
/ayuda — Ver este mensaje`;

const WELCOME_TEXT = `¡Hola! Soy el bot de <b>Zeta</b> 💰

Para empezar, vincula tu cuenta desde Zeta → Ajustes → Integraciones → Conectar Telegram.

Si ya tienes un token, envíame: <code>/vincular zeta_tu_token</code>`;

// ── Route handler ───────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // Verify the request comes from Telegram
  if (!verifySecretToken(request)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  let update: TelegramUpdate;
  try {
    update = await request.json();
  } catch {
    return NextResponse.json({ ok: true });
  }

  const message = update.message;
  if (!message?.text || !message.chat) {
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id;
  const text = message.text.trim();

  // ── /start (with optional deep link token) or /ayuda ──
  if (text.startsWith("/start") || text === "/ayuda") {
    const deepLinkPayload = text.replace("/start", "").trim();

    // Deep link: /start zeta_abc123... → auto-link account
    if (deepLinkPayload.startsWith("zeta_")) {
      const admin = createAdminClient();
      const { data: tokenRow } = await admin
        .from("capture_tokens")
        .select("id, user_id")
        .eq("token", deepLinkPayload)
        .is("revoked_at", null)
        .single();

      if (tokenRow) {
        await admin
          .from("capture_tokens")
          .update({ label: `telegram:${chatId}` })
          .eq("id", tokenRow.id);

        await sendMessage(chatId, "✅ <b>Cuenta vinculada automáticamente.</b>\n\nYa puedes enviar tus gastos e ingresos aquí.\n\nPrueba: <i>Gasté 15k en café</i>");
        return NextResponse.json({ ok: true });
      }

      await sendMessage(chatId, "Token no encontrado o expirado. Genera uno nuevo en Zeta → Ajustes → Integraciones.");
      return NextResponse.json({ ok: true });
    }

    const linked = await findTokenByChatId(chatId);
    await sendMessage(chatId, linked ? HELP_TEXT : WELCOME_TEXT);
    return NextResponse.json({ ok: true });
  }

  // ── /vincular <token> ──
  if (text.startsWith("/vincular")) {
    const token = text.replace("/vincular", "").trim();

    if (!token.startsWith("zeta_")) {
      await sendMessage(chatId, "Token inválido. Debe empezar con <code>zeta_</code>.\n\nGenera uno en Zeta → Ajustes → Integraciones.");
      return NextResponse.json({ ok: true });
    }

    const admin = createAdminClient();
    const { data: tokenRow } = await admin
      .from("capture_tokens")
      .select("id, user_id")
      .eq("token", token)
      .is("revoked_at", null)
      .single();

    if (!tokenRow) {
      await sendMessage(chatId, "Token no encontrado o ya fue revocado. Genera uno nuevo en Ajustes.");
      return NextResponse.json({ ok: true });
    }

    // Update label to link this chat
    await admin
      .from("capture_tokens")
      .update({ label: `telegram:${chatId}` })
      .eq("id", tokenRow.id);

    await sendMessage(chatId, "✅ <b>Cuenta vinculada.</b>\n\nAhora puedes enviar tus gastos e ingresos directamente aquí.\n\nPrueba: <i>Gasté 15k en café</i>");
    return NextResponse.json({ ok: true });
  }

  // ── /cuenta ──
  if (text === "/cuenta") {
    const linked = await findTokenByChatId(chatId);
    if (!linked) {
      await sendMessage(chatId, "No tienes cuenta vinculada.\n\nEnvía <code>/vincular zeta_tu_token</code> para empezar.");
      return NextResponse.json({ ok: true });
    }

    const admin = createAdminClient();
    if (linked.default_account_id) {
      const { data: account } = await admin
        .from("accounts")
        .select("name, currency_code, current_balance")
        .eq("id", linked.default_account_id)
        .single();

      if (account) {
        await sendMessage(
          chatId,
          `📋 <b>Cuenta vinculada:</b>\n${account.name}\nSaldo: ${formatCurrency(account.current_balance ?? 0, account.currency_code as CurrencyCode)}`,
        );
        return NextResponse.json({ ok: true });
      }
    }

    await sendMessage(chatId, "Cuenta vinculada pero sin cuenta predeterminada. Configura una en Zeta → Ajustes → Integraciones.");
    return NextResponse.json({ ok: true });
  }

  // ── Transaction capture ──
  const linked = await findTokenByChatId(chatId);
  if (!linked) {
    await sendMessage(chatId, "Primero vincula tu cuenta.\n\nEnvía <code>/vincular zeta_tu_token</code>");
    return NextResponse.json({ ok: true });
  }

  if (!linked.default_account_id) {
    await sendMessage(chatId, "No tienes cuenta predeterminada configurada. Ve a Zeta → Ajustes → Integraciones y asigna una cuenta al token.");
    return NextResponse.json({ ok: true });
  }

  // Parse the message
  const parseResult = await parseVoiceCapture(text);

  if (!parseResult.success) {
    const missing = parseResult.missing_fields.filter((f) => f !== "account_id");
    await sendMessage(
      chatId,
      `No pude interpretar todo. Faltan: <b>${missing.join(", ")}</b>\n\nIntenta algo como: <i>Gasté 15k en café</i>`,
    );
    return NextResponse.json({ ok: true });
  }

  const { amount, direction, description, merchant_name, transaction_date, capture_input_text } =
    parseResult.data;

  // Verify account
  const admin = createAdminClient();
  const { data: account } = await admin
    .from("accounts")
    .select("id, currency_code")
    .eq("id", linked.default_account_id)
    .eq("user_id", linked.user_id)
    .single();

  if (!account) {
    await sendMessage(chatId, "Error: la cuenta predeterminada ya no existe. Configura una nueva en Ajustes.");
    return NextResponse.json({ ok: true });
  }

  const currencyCode = account.currency_code as CurrencyCode;
  const categoryId = autoCategorize(merchant_name)?.category_id ?? null;

  const idempotencyKey = await computeIdempotencyKey({
    provider: "TELEGRAM",
    transactionDate: transaction_date,
    amount,
    rawDescription: capture_input_text,
  });

  const { data: tx, error: insertError } = await admin
    .from("transactions")
    .insert({
      user_id: linked.user_id,
      account_id: account.id,
      amount,
      currency_code: currencyCode,
      direction,
      transaction_date,
      raw_description: capture_input_text,
      clean_description: description,
      merchant_name,
      category_id: categoryId,
      idempotency_key: idempotencyKey,
      provider: "MANUAL",
      capture_method: "TEXT_QUICK_CAPTURE",
      capture_input_text: text,
      is_subscription: false,
      categorization_source: categoryId ? "SYSTEM_DEFAULT" : undefined,
    })
    .select("id, amount, direction, merchant_name, transaction_date")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      await sendMessage(chatId, "⚠️ Esta transacción ya fue registrada.");
    } else {
      await sendMessage(chatId, `Error: ${insertError.message}`);
    }
    return NextResponse.json({ ok: true });
  }

  const icon = direction === "OUTFLOW" ? "📤" : "📥";
  const label = direction === "OUTFLOW" ? "Gasto" : "Ingreso";

  await sendMessage(
    chatId,
    `✅ <b>Registrado</b>\n\n${icon} ${label}: <b>${formatCurrency(amount, currencyCode)}</b>\n📝 ${description}\n📅 ${transaction_date}`,
  );

  return NextResponse.json({ ok: true });
}
