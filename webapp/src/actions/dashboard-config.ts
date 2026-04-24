"use server";

import { cacheLife, cacheTag, updateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import {
  dashboardConfigSchema,
  mobileDashboardLayoutSchema,
} from "@/lib/validators/dashboard-config";
import type {
  DashboardConfig,
  MobileDashboardLayout,
} from "@/types/dashboard-config";
import type { ActionResult } from "@/types/actions";
import type { Json } from "@/types/database";

// ─── Cached inner readers ────────────────────────────────────────────────────

async function getDashboardConfigCached(
  userId: string,
  accessToken: string,
): Promise<DashboardConfig | null> {
  "use cache";
  cacheTag("dashboard-config");
  cacheLife("zeta");
  const supabase = createCachedClient(accessToken);
  const { data } = await supabase
    .from("profiles")
    .select("dashboard_config")
    .eq("id", userId)
    .single();
  if (!data?.dashboard_config) return null;
  return data.dashboard_config as unknown as DashboardConfig;
}

async function getDashboardConfigWithPurposeCached(
  userId: string,
  accessToken: string,
): Promise<{ config: DashboardConfig | null; appPurpose: string | null }> {
  "use cache";
  cacheTag("dashboard-config");
  cacheLife("zeta");
  const supabase = createCachedClient(accessToken);
  const { data } = await supabase
    .from("profiles")
    .select("dashboard_config, app_purpose")
    .eq("id", userId)
    .single();
  return {
    config: data?.dashboard_config
      ? (data.dashboard_config as unknown as DashboardConfig)
      : null,
    appPurpose: data?.app_purpose ?? null,
  };
}

async function getMobileLayoutCached(
  userId: string,
  accessToken: string,
): Promise<MobileDashboardLayout | null> {
  "use cache";
  cacheTag("dashboard-config");
  cacheLife("zeta");
  const supabase = createCachedClient(accessToken);
  const { data } = await supabase
    .from("profiles")
    .select("mobile_dashboard_config")
    .eq("id", userId)
    .single();
  if (!data?.mobile_dashboard_config) return null;
  return data.mobile_dashboard_config as unknown as MobileDashboardLayout;
}

// ─── Public actions ──────────────────────────────────────────────────────────

export async function updateDashboardConfig(
  config: DashboardConfig,
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
    .eq("id", user.id);

  if (error) {
    console.error("updateDashboardConfig failed", error);
    return { success: false, error: "No se pudo guardar la configuración" };
  }

  updateTag("dashboard-config");
  return { success: true, data: parsed.data };
}

export async function getDashboardConfig(): Promise<DashboardConfig | null> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return null;
  return getDashboardConfigCached(user.id, accessToken);
}

export async function updateMobileLayout(
  layout: MobileDashboardLayout,
): Promise<ActionResult<MobileDashboardLayout>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = mobileDashboardLayoutSchema.safeParse(layout);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ mobile_dashboard_config: parsed.data as unknown as Json })
    .eq("id", user.id);

  if (error) {
    console.error("updateMobileLayout failed", error);
    return { success: false, error: "No se pudo guardar tu layout" };
  }

  updateTag("dashboard-config");
  return { success: true, data: parsed.data as MobileDashboardLayout };
}

export async function getMobileLayout(): Promise<MobileDashboardLayout | null> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return null;
  return getMobileLayoutCached(user.id, accessToken);
}

export async function getDashboardConfigWithPurpose(): Promise<{
  config: DashboardConfig | null;
  appPurpose: string | null;
}> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return { config: null, appPurpose: null };
  return getDashboardConfigWithPurposeCached(user.id, accessToken);
}
