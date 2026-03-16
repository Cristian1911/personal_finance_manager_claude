"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import type { ActionResult } from "@/types/actions";
import type { CurrencyCode, Profile } from "@/types/domain";
import { z } from "zod";

/**
 * Get the user's effective preferred currency, with fallback.
 * Cached per request via React cache() to avoid duplicate queries.
 */
export const getPreferredCurrency = cache(async (): Promise<CurrencyCode> => {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return "COP" as CurrencyCode;

  const { data: profile } = await supabase
    .from("profiles")
    .select("preferred_currency")
    .eq("id", user.id)
    .single();

  return (profile?.preferred_currency ?? "COP") as CurrencyCode;
});

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
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
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

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/deudas");
  return { success: true, data };
}
