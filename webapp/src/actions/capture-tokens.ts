"use server";

import { randomBytes } from "crypto";
import { revalidateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import type { ActionResult } from "@/types/actions";

export type CaptureToken = {
  id: string;
  token: string;
  label: string;
  default_account_id: string | null;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

export async function getCaptureTokens(): Promise<ActionResult<CaptureToken[]>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("capture_tokens")
    .select("id, token, label, default_account_id, created_at, last_used_at, revoked_at")
    .eq("user_id", user.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });

  if (error) return { success: false, error: error.message };
  return { success: true, data: data as CaptureToken[] };
}

export async function createCaptureToken(
  _prev: ActionResult<CaptureToken>,
  formData: FormData,
): Promise<ActionResult<CaptureToken>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const label = (formData.get("label") as string)?.trim() || "Default";
  const defaultAccountId = (formData.get("default_account_id") as string) || null;

  const token = `zeta_${randomBytes(24).toString("hex")}`;

  const { data, error } = await supabase
    .from("capture_tokens")
    .insert({
      user_id: user.id,
      token,
      label,
      default_account_id: defaultAccountId || null,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  revalidateTag("capture-tokens", "zeta");
  return { success: true, data: data as CaptureToken };
}

const TELEGRAM_BOT_USERNAME = process.env.TELEGRAM_BOT_USERNAME ?? "ZetaFinanzasBot";

/**
 * Generate a capture token pre-labeled for Telegram and return the deep link URL.
 * The user clicks this link → Telegram opens → bot auto-links the account.
 */
export async function createTelegramLink(
  defaultAccountId: string,
): Promise<ActionResult<{ token: string; deepLink: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Check if user already has a telegram token
  const { data: existing } = await supabase
    .from("capture_tokens")
    .select("id, token")
    .eq("user_id", user.id)
    .like("label", "telegram:%")
    .is("revoked_at", null)
    .limit(1)
    .single();

  if (existing) {
    // Update default account if needed
    await supabase
      .from("capture_tokens")
      .update({ default_account_id: defaultAccountId })
      .eq("id", existing.id);

    return {
      success: true,
      data: {
        token: existing.token,
        deepLink: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${existing.token}`,
      },
    };
  }

  const token = `zeta_${randomBytes(24).toString("hex")}`;

  const { error } = await supabase
    .from("capture_tokens")
    .insert({
      user_id: user.id,
      token,
      label: "telegram:pending",
      default_account_id: defaultAccountId,
    });

  if (error) return { success: false, error: error.message };
  revalidateTag("capture-tokens", "zeta");

  return {
    success: true,
    data: {
      token,
      deepLink: `https://t.me/${TELEGRAM_BOT_USERNAME}?start=${token}`,
    },
  };
}

export async function revokeCaptureToken(tokenId: string): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("capture_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", tokenId)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };
  revalidateTag("capture-tokens", "zeta");
  return { success: true, data: null };
}
