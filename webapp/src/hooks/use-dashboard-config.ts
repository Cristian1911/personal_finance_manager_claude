"use client";

import { useState, useEffect, useCallback } from "react";
import type { DashboardConfig } from "@/types/dashboard-config";
import { getDefaultConfigForProfile } from "@/lib/dashboard-config-defaults";
import { updateDashboardConfig } from "@/actions/dashboard-config";

const STORAGE_KEY = "zeta:dashboard_config";

function readCache(): DashboardConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(config: DashboardConfig) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

export function useDashboardConfig(
  serverConfig: DashboardConfig | null,
  appPurpose: string | null,
) {
  const [config, setConfigState] = useState<DashboardConfig>(() => {
    const cached = readCache();
    if (cached) return cached;
    if (serverConfig) return serverConfig;
    return getDefaultConfigForProfile(appPurpose);
  });

  // Sync server config to cache on mount
  useEffect(() => {
    if (serverConfig) {
      writeCache(serverConfig);
      setConfigState(serverConfig);
    }
  }, [serverConfig]);

  const setConfig = useCallback((newConfig: DashboardConfig) => {
    setConfigState(newConfig);
    writeCache(newConfig);
    // Fire-and-forget DB sync
    updateDashboardConfig(newConfig).catch(() => {
      // Silent fail — localStorage is the optimistic source
    });
  }, []);

  return { config, setConfig };
}
