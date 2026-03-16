"use client";

import { useState, useEffect, useCallback } from "react";
import { FileUp, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { LucideIcon } from "lucide-react";

// --- Alert types ---

export type DashboardAlert = {
  key: string;
  priority: number;
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
};

type AlertContext = {
  accounts: {
    id: string;
    name: string;
    account_type: string;
    updated_at: string | null;
  }[];
  latestSnapshotDates: Record<string, string>;
};

// --- Dismissal helpers (localStorage) ---

const STORAGE_KEY = "zeta_dismissed_alerts";
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getDismissedMap(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function dismissAlert(key: string) {
  const map = getDismissedMap();
  map[key] = Date.now() + SNOOZE_MS;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function isDismissed(key: string): boolean {
  const map = getDismissedMap();
  const snoozedUntil = map[key];
  if (!snoozedUntil) return false;
  if (Date.now() > snoozedUntil) {
    // Expired — clean up
    delete map[key];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    return false;
  }
  return true;
}

// --- Alert producers ---

const IMPORTABLE_TYPES = new Set(["CREDIT_CARD", "LOAN", "SAVINGS"]);
const STALE_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function staleImportAlerts(ctx: AlertContext): DashboardAlert[] {
  const now = Date.now();
  const alerts: DashboardAlert[] = [];

  for (const account of ctx.accounts) {
    if (!IMPORTABLE_TYPES.has(account.account_type)) continue;

    const lastDate =
      ctx.latestSnapshotDates[account.id] ?? account.updated_at;
    if (!lastDate) continue;

    const ageMs = now - new Date(lastDate).getTime();
    if (ageMs < STALE_THRESHOLD_MS) continue;

    const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    alerts.push({
      key: `stale_import:${account.id}`,
      priority: 10,
      icon: FileUp,
      title: account.name,
      description: `Hace ${days} días que no importas un extracto`,
      actionLabel: "Importar extracto",
      actionHref: "/import",
    });
  }

  return alerts;
}

const ALERT_PRODUCERS = [staleImportAlerts];

// --- Component ---

const MAX_VISIBLE = 3;

interface DashboardAlertsProps {
  accounts: {
    id: string;
    name: string;
    account_type: string;
    updated_at: string | null;
  }[];
  latestSnapshotDates: Record<string, string>;
}

export function DashboardAlerts({
  accounts,
  latestSnapshotDates,
}: DashboardAlertsProps) {
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const ctx: AlertContext = { accounts, latestSnapshotDates };

  const allAlerts = ALERT_PRODUCERS.flatMap((producer) => producer(ctx))
    .sort((a, b) => a.priority - b.priority);

  const visibleAlerts = mounted
    ? allAlerts
        .filter((a) => !isDismissed(a.key) && !dismissedKeys.has(a.key))
        .slice(0, MAX_VISIBLE)
    : [];

  const handleDismiss = useCallback((key: string) => {
    dismissAlert(key);
    setDismissedKeys((prev) => new Set(prev).add(key));
  }, []);

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {visibleAlerts.map((alert) => (
        <div
          key={alert.key}
          className="flex items-start gap-3 rounded-lg border border-z-alert/20 bg-z-alert/5 p-3"
        >
          <alert.icon className="mt-0.5 h-4 w-4 shrink-0 text-z-alert" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">{alert.title}</p>
            <p className="text-xs text-muted-foreground">
              {alert.description}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {alert.actionHref && (
              <Link href={alert.actionHref}>
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  {alert.actionLabel}
                </Button>
              </Link>
            )}
            <button
              onClick={() => handleDismiss(alert.key)}
              className="p-1 rounded-md hover:bg-z-alert/10 transition-colors"
              aria-label={`Ocultar alerta: ${alert.title}`}
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
