"use client";

import { trackProductEvent, type ProductEventInput } from "@/actions/product-events";

const SESSION_KEY = "pfm_session_id";

function generateSessionId() {
  const rand = Math.random().toString(36).slice(2, 10);
  return `${Date.now()}-${rand}`;
}

export function getAnalyticsSessionId(): string {
  if (typeof window === "undefined") return "server";
  const existing = window.sessionStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const created = generateSessionId();
  window.sessionStorage.setItem(SESSION_KEY, created);
  return created;
}

export async function trackClientEvent(
  event: Omit<ProductEventInput, "platform" | "session_id">
): Promise<void> {
  try {
    await trackProductEvent({
      ...event,
      platform: "web",
      session_id: getAnalyticsSessionId(),
    });
  } catch {
    // Best-effort only; never block UX on analytics
  }
}

