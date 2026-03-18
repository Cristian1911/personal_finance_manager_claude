"use server";

import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { dashboardConfigSchema } from "@/lib/validators/dashboard-config";
import type { DashboardConfig } from "@/types/dashboard-config";
import type { ActionResult } from "@/types/actions";
import type { Json } from "@/types/database";

export async function updateDashboardConfig(
  config: DashboardConfig
): Promise<ActionResult<DashboardConfig>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = dashboardConfigSchema.safeParse(config);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ dashboard_config: parsed.data as unknown as Json })
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  return { success: true, data: parsed.data };
}

export async function getDashboardConfig(): Promise<DashboardConfig | null> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("dashboard_config, app_purpose")
    .eq("user_id", user.id)
    .single();

  if (!data?.dashboard_config) return null;
  return data.dashboard_config as unknown as DashboardConfig;
}

export async function getDashboardConfigWithPurpose(): Promise<{
  config: DashboardConfig | null;
  appPurpose: string | null;
}> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { config: null, appPurpose: null };

  const { data } = await supabase
    .from("profiles")
    .select("dashboard_config, app_purpose")
    .eq("user_id", user.id)
    .single();

  return {
    config: data?.dashboard_config
      ? (data.dashboard_config as unknown as DashboardConfig)
      : null,
    appPurpose: data?.app_purpose ?? null,
  };
}
