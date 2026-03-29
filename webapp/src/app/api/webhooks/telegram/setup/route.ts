import { NextRequest, NextResponse } from "next/server";
import { setWebhook } from "@/lib/telegram";

/**
 * One-time setup: registers the webhook URL with Telegram.
 * Call once after deploy:
 *   curl "https://your-app.com/api/webhooks/telegram/setup?secret=YOUR_BOT_TOKEN_ID"
 *
 * The secret is the numeric part before the colon in your bot token (e.g., "7234567890").
 */
export async function GET(request: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ error: "TELEGRAM_BOT_TOKEN not configured" }, { status: 500 });
  }

  // Simple auth: require the bot token ID as a query param
  const secret = request.nextUrl.searchParams.get("secret");
  const expectedSecret = botToken.split(":")[0];

  if (secret !== expectedSecret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
  }

  // Determine webhook URL from the request
  const appUrl = request.nextUrl.origin;
  const webhookUrl = `${appUrl}/api/webhooks/telegram`;

  const result = await setWebhook(webhookUrl);

  return NextResponse.json({
    webhook_url: webhookUrl,
    telegram_response: result,
  });
}
