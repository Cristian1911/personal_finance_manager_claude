import type { DashboardLayout } from "@zeta/shared";
import { getDatabase } from "../db/database";
import { invalidatePreferredCurrency } from "../profile";

export type BootstrapProfile = {
  id: string;
  email?: string | null;
  full_name: string;
  app_purpose: string;
  estimated_monthly_income: number;
  estimated_monthly_expenses: number;
  preferred_currency: string;
  timezone: string;
  locale: string;
  onboarding_completed: boolean;
  dashboard_config?: unknown;
  mobile_dashboard_config?: DashboardLayout;
  created_at?: string | null;
  updated_at: string;
};

export type BootstrapAccount = {
  id: string;
  user_id: string;
  name: string;
  account_type: string;
  institution_name?: string | null;
  currency_code: string;
  current_balance: number;
  available_balance?: number | null;
  credit_limit?: number | null;
  interest_rate?: number | null;
  icon?: string | null;
  color?: string | null;
  monthly_payment?: number | null;
  payment_day?: number | null;
  cutoff_day?: number | null;
  bank_key?: string | null;
  pdf_password?: string | null;
  created_at: string;
  updated_at: string;
};

export async function bootstrapOnboardingLocally({
  profile,
  account,
}: {
  profile: BootstrapProfile;
  account: BootstrapAccount;
}): Promise<void> {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `INSERT INTO profiles
        (id, email, full_name, app_purpose, estimated_monthly_income,
         estimated_monthly_expenses, preferred_currency, timezone, locale,
         onboarding_completed, plan, created_at, updated_at, dashboard_config,
         mobile_dashboard_config)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'free', ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         email = excluded.email,
         full_name = excluded.full_name,
         app_purpose = excluded.app_purpose,
         estimated_monthly_income = excluded.estimated_monthly_income,
         estimated_monthly_expenses = excluded.estimated_monthly_expenses,
         preferred_currency = excluded.preferred_currency,
         timezone = excluded.timezone,
         locale = excluded.locale,
         onboarding_completed = excluded.onboarding_completed,
         updated_at = excluded.updated_at,
         dashboard_config = excluded.dashboard_config,
         mobile_dashboard_config = excluded.mobile_dashboard_config`,
      [
        profile.id,
        profile.email ?? null,
        profile.full_name,
        profile.app_purpose,
        profile.estimated_monthly_income,
        profile.estimated_monthly_expenses,
        profile.preferred_currency,
        profile.timezone,
        profile.locale,
        profile.onboarding_completed ? 1 : 0,
        profile.created_at ?? profile.updated_at,
        profile.updated_at,
        profile.dashboard_config ? JSON.stringify(profile.dashboard_config) : null,
        profile.mobile_dashboard_config
          ? JSON.stringify(profile.mobile_dashboard_config)
          : null,
      ]
    );

    await db.runAsync(
      `INSERT INTO accounts
        (id, user_id, name, account_type, institution_name, currency_code,
         current_balance, available_balance, credit_limit, interest_rate,
         is_active, icon, color, monthly_payment, payment_day, cutoff_day,
         bank_key, pdf_password, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         account_type = excluded.account_type,
         institution_name = excluded.institution_name,
         currency_code = excluded.currency_code,
         current_balance = excluded.current_balance,
         available_balance = excluded.available_balance,
         credit_limit = excluded.credit_limit,
         interest_rate = excluded.interest_rate,
         icon = excluded.icon,
         color = excluded.color,
         monthly_payment = excluded.monthly_payment,
         payment_day = excluded.payment_day,
         cutoff_day = excluded.cutoff_day,
         bank_key = excluded.bank_key,
         pdf_password = excluded.pdf_password,
         updated_at = excluded.updated_at`,
      [
        account.id,
        account.user_id,
        account.name,
        account.account_type,
        account.institution_name ?? null,
        account.currency_code,
        account.current_balance,
        account.available_balance ?? null,
        account.credit_limit ?? null,
        account.interest_rate ?? null,
        account.icon ?? null,
        account.color ?? null,
        account.monthly_payment ?? null,
        account.payment_day ?? null,
        account.cutoff_day ?? null,
        account.bank_key ?? null,
        account.pdf_password ?? null,
        account.created_at,
        account.updated_at,
      ]
    );
  });

  // Drop the in-memory preferred-currency cache so the next read (typically
  // the first dashboard load after onboarding) picks up the chosen value
  // rather than an initial "COP" default.
  invalidatePreferredCurrency();
}
