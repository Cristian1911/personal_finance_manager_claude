"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types/actions";
import type { Profile } from "@/types/domain";
import { z } from "zod";

const profileSchema = z.object({
  full_name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  preferred_currency: z.enum(["COP", "BRL", "MXN", "USD", "EUR", "PEN", "CLP", "ARS"]),
  locale: z.string().default("es-CO"),
  timezone: z.string().default("America/Bogota"),
});

export async function getProfile(): Promise<ActionResult<Profile>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { success: false, error: "No autenticado" };

  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    preferred_currency: formData.get("preferred_currency"),
    locale: formData.get("locale") || "es-CO",
    timezone: formData.get("timezone") || "America/Bogota",
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
  return { success: true, data };
}
