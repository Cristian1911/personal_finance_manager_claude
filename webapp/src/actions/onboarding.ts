"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { Database } from "@/types/database";

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
    accountData: InitialAccountData
) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

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
            onboarding_completed: true,
        })
        .eq("id", user.id);

    if (profileError) {
        console.error("Failed to update profile:", profileError);
        throw new Error("Failed to finalize onboarding setup. Please try again.");
    }

    revalidatePath("/dashboard");
    revalidatePath("/", "layout");
}
