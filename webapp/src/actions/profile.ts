"use server";

import { revalidateTag, cacheTag, cacheLife } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/types/actions";
import type { CurrencyCode, Profile } from "@/types/domain";
import { z } from "zod";

// ─── Cached inner functions ───────────────────────────────────────────────────

async function getPreferredCurrencyCached(userId: string): Promise<CurrencyCode> {
  "use cache";
  cacheTag("profile");
  cacheLife("zeta");

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_currency")
    .eq("id", userId)
    .single();

  return (profile?.preferred_currency ?? "COP") as CurrencyCode;
}

async function getProfileCached(userId: string): Promise<Profile> {
  "use cache";
  cacheTag("profile");
  cacheLife("zeta");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return data;
}

// ─── Public wrappers ──────────────────────────────────────────────────────────

/**
 * Get the user's effective preferred currency, with fallback.
 */
export async function getPreferredCurrency(): Promise<CurrencyCode> {
  const { user } = await getAuthenticatedClient();
  if (!user) return "COP" as CurrencyCode;
  return getPreferredCurrencyCached(user.id);
}

const profileSchema = z.object({
  full_name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  preferred_currency: z.enum(["COP", "BRL", "MXN", "USD", "EUR", "PEN", "CLP", "ARS"]),
  locale: z.string().default("es-CO"),
  timezone: z.string().default("America/Bogota"),
  monthly_salary: z.preprocess(
    (v) => (v === "" || v === undefined || v === null ? null : Number(v)),
    z.number().int().positive("El salario debe ser positivo").nullable()
  ),
});

export async function getProfile(): Promise<ActionResult<Profile>> {
  const { user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  try {
    const data = await getProfileCached(user.id);
    return { success: true, data };
  } catch {
    return { success: false, error: "Error al cargar el perfil" };
  }
}

export async function updateProfile(
  _prevState: ActionResult<Profile>,
  formData: FormData
): Promise<ActionResult<Profile>> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return { success: false, error: "No autenticado" };

  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    preferred_currency: formData.get("preferred_currency"),
    locale: formData.get("locale") || "es-CO",
    timezone: formData.get("timezone") || "America/Bogota",
    monthly_salary: formData.get("monthly_salary"),
  });

  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { data, error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("id", user.id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidateTag("profile", "zeta");
  revalidateTag("dashboard:hero", "zeta");
  return { success: true, data };
}
