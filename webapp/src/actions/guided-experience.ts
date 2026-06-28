"use server";

import { updateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { dashboardConfigSchema } from "@/lib/validators/dashboard-config";
import { isDebtAccountType } from "@/lib/utils/account-balance";
import type {
  AppPurpose,
  DashboardConfig,
  GuidedExperienceState,
} from "@/types/dashboard-config";
import type { Json } from "@/types/database";

/** Lightweight result for fire-and-forget guided-experience mutations. */
type GuidedResult = { success: boolean; error?: string };

/* ─────────────────────────── First-steps view model ─────────────────────── */

export interface FirstStep {
  id: string;
  label: string;
  href: string;
  done: boolean;
}

export interface FirstStepsData {
  collapsed: boolean;
  steps: FirstStep[];
  doneCount: number;
  total: number;
}

interface Signals {
  hasAccounts: boolean;
  hasDebtAccount: boolean;
  hasTransactions: boolean;
  incomeConfigured: boolean;
  hasBudget: boolean;
  hasRecurring: boolean;
}

const HREF = {
  accounts: "/accounts",
  import: "/import",
  income: "/settings/perfil",
  budget: "/plan?tab=presupuesto",
  debt: "/deudas",
  recurrentes: "/recurrentes/new",
} as const;

/** Steps seeded by the user's onboarding purpose. Each completes from real data
 *  (design D2: "la meta es desbloquear el veredicto, no completar tareas"). */
function buildSteps(purpose: AppPurpose | null, s: Signals): FirstStep[] {
  switch (purpose) {
    case "manage_debt":
      return [
        { id: "debt-account", label: "Marca una cuenta como deuda", href: HREF.debt, done: s.hasDebtAccount },
        { id: "income", label: "Confirma tu ingreso mensual", href: HREF.income, done: s.incomeConfigured },
        { id: "import", label: "Importa un extracto", href: HREF.import, done: s.hasTransactions },
        { id: "recurring", label: "Registra tus pagos recurrentes", href: HREF.recurrentes, done: s.hasRecurring },
      ];
    case "save_money":
      return [
        { id: "accounts", label: "Crea tus cuentas y saldo", href: HREF.accounts, done: s.hasAccounts },
        { id: "income", label: "Confirma tu ingreso mensual", href: HREF.income, done: s.incomeConfigured },
        { id: "budget", label: "Crea tu presupuesto 50/30/20", href: HREF.budget, done: s.hasBudget },
        { id: "import", label: "Importa tus movimientos", href: HREF.import, done: s.hasTransactions },
      ];
    default: // track_spending · improve_habits · null
      return [
        { id: "import", label: "Importa un extracto", href: HREF.import, done: s.hasTransactions },
        { id: "accounts", label: "Agrega tus cuentas", href: HREF.accounts, done: s.hasAccounts },
        { id: "income", label: "Confirma tu ingreso", href: HREF.income, done: s.incomeConfigured },
        { id: "budget", label: "Define tu presupuesto", href: HREF.budget, done: s.hasBudget },
      ];
  }
}

/**
 * Returns the "Primeros pasos" card view-model, or null when it should not show
 * (dismissed, snoozed, or every step already complete). Live signal reads —
 * the card must reflect activation progress immediately.
 * ponytail: live read (not cached) — small count queries, must be real-time.
 */
export async function getFirstStepsData(): Promise<FirstStepsData | null> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return null;

  // Fetch the profile first: dismissed/snoozed users (the steady state once
  // someone has interacted) short-circuit here without paying the signal
  // queries below.
  const { data: profile } = await supabase
    .from("profiles")
    .select("budget_mode, estimated_monthly_income, monthly_salary, app_purpose, dashboard_config")
    .eq("id", user.id)
    .single();

  const config = (profile?.dashboard_config as unknown as DashboardConfig | null) ?? null;
  const firstSteps = config?.guidedExperience?.firstSteps;

  // Permanently dismissed or snoozed → hide (before any signal queries).
  if (firstSteps?.dismissedAt) return null;
  if (firstSteps?.snoozeUntil && firstSteps.snoozeUntil > new Date().toISOString()) return null;

  const [txRes, acctRes, recRes, budgetRes] = await Promise.all([
    supabase.from("transactions").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    supabase.from("accounts").select("account_type").eq("user_id", user.id),
    supabase.from("recurring_transaction_templates").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    // Budget step completes on a SAVED budget row, not budget_mode — the wizard
    // sets budget_mode when entering the builder, before anything is saved.
    supabase.from("budgets").select("id", { count: "exact", head: true }).eq("user_id", user.id),
  ]);

  const accounts = acctRes.data ?? [];

  const signals: Signals = {
    hasAccounts: accounts.length > 0,
    hasDebtAccount: accounts.some((a) => isDebtAccountType(a.account_type)),
    hasTransactions: (txRes.count ?? 0) > 0,
    incomeConfigured:
      Number(profile?.estimated_monthly_income ?? 0) > 0 ||
      Number(profile?.monthly_salary ?? 0) > 0,
    hasBudget: (budgetRes.count ?? 0) > 0,
    hasRecurring: (recRes.count ?? 0) > 0,
  };

  const steps = buildSteps((profile?.app_purpose as AppPurpose | null) ?? null, signals);
  const doneCount = steps.filter((step) => step.done).length;

  // Everything done → the user is activated; retire the card.
  if (doneCount === steps.length) return null;

  return {
    collapsed: firstSteps?.collapsed ?? false,
    steps,
    doneCount,
    total: steps.length,
  };
}

/* ─────────────────────────── Persistence (read-merge-write) ──────────────── */

async function patchGuided(
  apply: (g: GuidedExperienceState) => GuidedExperienceState,
): Promise<GuidedResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data } = await supabase
    .from("profiles")
    .select("dashboard_config")
    .eq("id", user.id)
    .single();

  const config = (data?.dashboard_config as unknown as DashboardConfig | null) ?? null;
  // Config-less users (no onboarding config) can't persist — no-op gracefully.
  if (!config) return { success: true };

  const nextConfig: DashboardConfig = {
    ...config,
    guidedExperience: apply(config.guidedExperience ?? {}),
  };

  const parsed = dashboardConfigSchema.safeParse(nextConfig);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ dashboard_config: parsed.data as unknown as Json })
    .eq("id", user.id);

  if (error) {
    console.error("patchGuided failed", error);
    return { success: false, error: "No se pudo guardar" };
  }

  updateTag("dashboard-config");
  return { success: true };
}

export async function dismissFirstSteps(): Promise<GuidedResult> {
  return patchGuided((g) => ({
    ...g,
    firstSteps: { ...g.firstSteps, dismissedAt: new Date().toISOString() },
  }));
}

export async function snoozeFirstSteps(): Promise<GuidedResult> {
  const until = new Date();
  until.setDate(until.getDate() + 1);
  return patchGuided((g) => ({
    ...g,
    firstSteps: { ...g.firstSteps, snoozeUntil: until.toISOString() },
  }));
}

export async function setFirstStepsCollapsed(collapsed: boolean): Promise<GuidedResult> {
  return patchGuided((g) => ({
    ...g,
    firstSteps: { ...g.firstSteps, collapsed },
  }));
}

/* ─────────────────────────── Coach-marks (D5) ────────────────────────────── */

export async function getSeenCoachMarks(): Promise<string[]> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return [];
  const { data } = await supabase
    .from("profiles")
    .select("dashboard_config")
    .eq("id", user.id)
    .single();
  const config = (data?.dashboard_config as unknown as DashboardConfig | null) ?? null;
  return config?.guidedExperience?.seenCoachMarks ?? [];
}

export async function markCoachMarkSeen(id: string): Promise<GuidedResult> {
  return patchGuided((g) => ({
    ...g,
    seenCoachMarks: Array.from(new Set([...(g.seenCoachMarks ?? []), id])),
  }));
}
