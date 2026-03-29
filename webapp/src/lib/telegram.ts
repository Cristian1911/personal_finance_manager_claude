const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

export async function sendMessage(chatId: number, text: string, extra?: Record<string, unknown>) {
  if (!BOT_TOKEN) return;

  await fetch(`${API_BASE}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: "HTML",
      ...extra,
    }),
  });
}

export async function setWebhook(url: string) {
  if (!BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not set");

  const res = await fetch(`${API_BASE}/setWebhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      allowed_updates: ["message"],
      secret_token: BOT_TOKEN.split(":")[0],
    }),
  });

  return res.json();
}

export function verifySecretToken(request: Request): boolean {
  if (!BOT_TOKEN) return false;
  const secret = request.headers.get("x-telegram-bot-api-secret-token");
  return secret === BOT_TOKEN.split(":")[0];
}
