"use server";

import { createClient } from "@/lib/supabase/server";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { loginSchema, signupSchema, forgotPasswordSchema, resetPasswordSchema } from "@/lib/validators/auth";
import { trackProductEvent, trackProductEventForUser } from "@/actions/product-events";
import { revalidateAllUserData } from "@/lib/cache/revalidation";
import { derivePublicBaseUrl } from "@/lib/utils/public-base-url";

export type AuthActionResult = {
  error?: string;
  success?: boolean;
};

const AUTH_ERROR_MAP: Record<string, string> = {
  "Invalid login credentials": "Credenciales incorrectas",
  "Email not confirmed": "Correo no confirmado",
  "User already registered": "Este correo ya está registrado",
  "Password should be at least 6 characters": "La contraseña debe tener al menos 6 caracteres",
  "Email rate limit exceeded": "Demasiados intentos. Intenta más tarde",
  "For security purposes, you can only request this once every 60 seconds": "Por seguridad, solo puedes solicitar esto una vez cada 60 segundos",
  "Database error saving new user": "Error al crear usuario. Intenta nuevamente",
};

function translateAuthError(message: string): string {
  return AUTH_ERROR_MAP[message] ?? message;
}

export async function signIn(
  _prevState: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    await trackProductEvent({
      event_name: "auth_login_completed",
      flow: "onboarding",
      step: "login",
      entry_point: "cta",
      success: false,
      error_code: "invalid_payload",
    });
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    await trackProductEvent({
      event_name: "auth_login_completed",
      flow: "onboarding",
      step: "login",
      entry_point: "cta",
      success: false,
      error_code: "login_failed",
      metadata: { email: parsed.data.email },
    });
    return { error: translateAuthError(error.message) };
  }

  await trackProductEvent({
    event_name: "auth_login_completed",
    flow: "onboarding",
    step: "login",
    entry_point: "cta",
    success: true,
    metadata: { email: parsed.data.email },
  });
  redirect("/dashboard");
}

export async function signUp(
  _prevState: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    await trackProductEvent({
      event_name: "auth_signup_completed",
      flow: "onboarding",
      step: "signup",
      entry_point: "cta",
      success: false,
      error_code: "invalid_payload",
    });
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  // If the visitor is mid-demo under an anonymous session, promote it in
  // place via updateUser so their seeded data carries over. Otherwise do a
  // fresh signUp.
  const { data: existing } = await supabase.auth.getUser();
  if (existing.user?.is_anonymous) {
    const { error: promoteError } = await supabase.auth.updateUser({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (promoteError) {
      await trackProductEvent({
        event_name: "auth_signup_completed",
        flow: "onboarding",
        step: "signup",
        entry_point: "cta",
        success: false,
        error_code: "signup_failed",
        metadata: { email: parsed.data.email },
      });
      return { error: translateAuthError(promoteError.message) };
    }
    void trackProductEventForUser(existing.user.id, {
      event_name: "auth_signup_completed",
      flow: "onboarding",
      step: "signup",
      entry_point: "cta",
      success: true,
      metadata: { email: parsed.data.email, from_anonymous: true },
    });
    // Anonymous user already has a full profile (onboarding_completed=true,
    // seeded demo data). Drop them on the dashboard — they can exit demo
    // from the banner when they're ready.
    redirect("/dashboard");
  }

  const reqHeaders = await headers();
  const baseUrl = derivePublicBaseUrl(
    reqHeaders.get("host"),
    reqHeaders.get("x-forwarded-proto")
  );
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      // Still sent if project-level "Confirm email" is ON. When OFF (recommended),
      // the session is returned immediately and we skip the email dance.
      emailRedirectTo: `${baseUrl}/auth/callback`,
    },
  });

  if (error) {
    await trackProductEvent({
      event_name: "auth_signup_completed",
      flow: "onboarding",
      step: "signup",
      entry_point: "cta",
      success: false,
      error_code: "signup_failed",
      metadata: { email: parsed.data.email },
    });
    return { error: translateAuthError(error.message) };
  }

  if (data.user?.id) {
    void trackProductEventForUser(data.user.id, {
      event_name: "auth_signup_completed",
      flow: "onboarding",
      step: "signup",
      entry_point: "cta",
      success: true,
      metadata: { email: parsed.data.email },
    });
  }

  // Project-level "Confirm email" must be OFF so the session is returned directly.
  // If it's still ON, the user sees a clear error instead of a blank screen.
  if (!data.session) {
    return {
      error:
        "No pudimos iniciar tu sesión. Contacta a soporte o intenta iniciar sesión.",
    };
  }
  redirect("/onboarding");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

// Wipes ALL the calling user's app data but keeps the auth.users row and
// active session. Mirrors the mobile flow in `mobile/lib/reset-data.ts`:
// the SECURITY DEFINER `reset_user_data()` RPC scopes everything to
// auth.uid(); the profile row is reset (`onboarding_completed = false`)
// so the dashboard layout bounces the user to /onboarding on the next
// navigation.
export async function resetUserData(): Promise<AuthActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { error: "No autenticado" };

  if (user.is_anonymous) {
    return {
      error:
        "Estás en modo demo. Cierra sesión y crea una cuenta real para gestionar tus datos.",
    };
  }

  const { error } = await supabase.rpc("reset_user_data");
  if (error) {
    console.error("[resetUserData] RPC failed:", error);
    return { error: "No se pudo borrar los datos. Intenta de nuevo." };
  }

  revalidateAllUserData();

  redirect("/onboarding?reset=1");
}

// Permanently deletes the calling user's account and ALL associated data.
// Required by Apple App Store Guideline 5.1.1(v) and Google Play Data
// Safety. Wipes app tables via reset_user_data() and deletes the
// auth.users row (cascades the rest).
export async function deleteAccount(): Promise<AuthActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { error: "No autenticado" };

  // Anonymous demo sessions: the "Eliminar cuenta" affordance is for real
  // accounts. Demo users are cleaned up by the daily cron — letting them
  // hit this RPC works at the DB level but is a UX footgun.
  if (user.is_anonymous) {
    return {
      error:
        "Estás en modo demo. Cierra sesión y crea una cuenta real para gestionar tus datos.",
    };
  }

  // RPC is `SECURITY DEFINER` and re-checks `auth.uid()` server-side, so
  // a caller can only delete their own account.
  const { error } = await supabase.rpc("delete_user_account");
  if (error) {
    console.error("[deleteAccount] RPC failed:", error);
    return {
      error: "No se pudo eliminar la cuenta. Intenta de nuevo.",
    };
  }

  await supabase.auth.signOut();
  redirect("/login?deleted=1");
}

export async function resetPasswordRequest(
  _prevState: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const reqHeaders = await headers();
  const baseUrl = derivePublicBaseUrl(
    reqHeaders.get("host"),
    reqHeaders.get("x-forwarded-proto")
  );
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${baseUrl}/auth/callback?next=/reset-password`,
  });

  if (error) {
    return { error: translateAuthError(error.message) };
  }

  return { success: true };
}

export async function updatePassword(
  _prevState: AuthActionResult,
  formData: FormData
): Promise<AuthActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: translateAuthError(error.message) };
  }

  redirect("/dashboard");
}
