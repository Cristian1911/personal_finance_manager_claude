"use server";

import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { updateTag } from "next/cache";
import { Database, type Json } from "@/types/database";
import type { DashboardConfig, MobileDashboardLayout } from "@/types/dashboard-config";

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
