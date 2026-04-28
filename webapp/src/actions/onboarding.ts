"use server";

import { z } from "zod";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { updateTag } from "next/cache";
import { Database, type Json } from "@/types/database";
import type { DashboardConfig, MobileDashboardLayout } from "@/types/dashboard-config";
import { inferCurrencyFromTimezone } from "@/lib/utils/currency-from-timezone";

export type OnboardingProfileData = {
    app_purpose: string;
    estimated_monthly_income: number;
    estimated_monthly_expenses: number;
    full_name: string;
    preferred_currency: string;
    timezone: string;
    locale: string;
};

export type InitialAccountData = {
    name: string;
    account_type: string;
    current_balance: number;
};

export async function finishOnboarding(
    profileData: OnboardingProfileData,
    accountData: InitialAccountData,
    dashboardConfig?: DashboardConfig | null,
    mobileDashboardConfig?: MobileDashboardLayout | null,
) {
    const { supabase, user } = await getAuthenticatedClient();

    if (!user) {
        throw new Error("Unauthorized");
    }

    // Define default values
    const defaultCurrency = profileData.preferred_currency as Database["public"]["Enums"]["currency_code"];

    // 1. Create Initial Account
    const { error: accountError } = await supabase
        .from("accounts")
        .insert({
            user_id: user.id,
            name: accountData.name,
            account_type: accountData.account_type as Database["public"]["Enums"]["account_type"],
            current_balance: accountData.current_balance,
            currency_code: defaultCurrency,
            is_active: true,
            display_order: 0,
            provider: "MANUAL",
            connection_status: "CONNECTED",
        });

    if (accountError) {
        console.error("Failed to create initial account:", accountError);
        throw new Error("Failed to create account. Please try again.");
    }

    // Derive primary nav focus from purpose: debt-focused users get the Deudas
    // tab promoted; everyone else gets Plan.
    const navFocus: Database["public"]["Enums"]["nav_focus"] =
        profileData.app_purpose === "manage_debt" ? "DEBT" : "PLAN";

    // 2. Update Profile to include onboarding preferences and mark completed
    const { error: profileError } = await supabase
        .from("profiles")
        .update({
            app_purpose: profileData.app_purpose,
            estimated_monthly_income: profileData.estimated_monthly_income,
            estimated_monthly_expenses: profileData.estimated_monthly_expenses,
            full_name: profileData.full_name,
            preferred_currency: defaultCurrency,
            timezone: profileData.timezone,
            locale: profileData.locale,
            nav_focus: navFocus,
            onboarding_completed: true,
            ...(dashboardConfig ? { dashboard_config: dashboardConfig as unknown as Json } : {}),
            ...(mobileDashboardConfig ? { mobile_dashboard_config: mobileDashboardConfig as unknown as Json } : {}),
        })
        .eq("id", user.id);

    if (profileError) {
        console.error("Failed to update profile:", profileError);
        throw new Error("Failed to finalize onboarding setup. Please try again.");
    }

    updateTag("profile");
    updateTag("accounts");
    updateTag("dashboard:hero");
    updateTag("dashboard:accounts");
}

// ─── Skip onboarding with sensible defaults ────────────────────────────────
//
// Lets a signed-up user land on the dashboard without filling every step.
// Creates a placeholder cuenta + sets minimal profile values; everything is
// editable later in Settings → Perfil and /accounts. We mark `app_purpose`
// as `track_spending` (the most generic) so `nav_focus` defaults to PLAN.
//
// Idempotent: if the profile already has `onboarding_completed = true`, we
// return without re-inserting the placeholder account (handles double-click
// or retry).

const skipInputSchema = z.object({
    // Permissive IANA shape (Region/City). Just a sanity guard against
    // arbitrary client input — the value is stored verbatim.
    timezone: z.string().regex(/^[A-Za-z]+\/[A-Za-z_/]+$/).optional(),
    full_name: z.string().trim().min(1).max(120).optional(),
});

export async function skipOnboardingWithDefaults(input: {
    full_name?: string;
    timezone?: string;
}): Promise<void> {
    const { supabase, user } = await getAuthenticatedClient();
    if (!user) throw new Error("Unauthorized");

    const parsed = skipInputSchema.safeParse(input);
    if (!parsed.success) {
        throw new Error("Datos de configuración inválidos.");
    }

    // Idempotency guard: if onboarding already finished (e.g. double-submit
    // or a retry after a network blip), short-circuit so we don't insert
    // duplicate "Mi cuenta" rows or overwrite the user's later edits.
    const { data: existing } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", user.id)
        .single();
    if (existing?.onboarding_completed) return;

    const timezone = parsed.data.timezone || "America/Bogota";
    const currency = inferCurrencyFromTimezone(timezone);
    const fullName = parsed.data.full_name ?? null;

    const { error: accountError } = await supabase
        .from("accounts")
        .insert({
            user_id: user.id,
            name: "Mi cuenta",
            account_type: "CHECKING",
            current_balance: 0,
            currency_code: currency,
            is_active: true,
            display_order: 0,
            provider: "MANUAL",
            connection_status: "CONNECTED",
        });
    if (accountError) {
        console.error("skipOnboardingWithDefaults account insert failed:", accountError);
        throw new Error("No se pudo crear la cuenta inicial.");
    }

    const { error: profileError } = await supabase
        .from("profiles")
        .update({
            app_purpose: "track_spending",
            full_name: fullName,
            preferred_currency: currency,
            timezone,
            locale: "es-CO",
            nav_focus: "PLAN",
            onboarding_completed: true,
        })
        .eq("id", user.id);
    if (profileError) {
        console.error("skipOnboardingWithDefaults profile update failed:", profileError);
        throw new Error("No se pudo finalizar la configuración.");
    }

    updateTag("profile");
    updateTag("accounts");
    updateTag("dashboard:hero");
    updateTag("dashboard:accounts");
}
