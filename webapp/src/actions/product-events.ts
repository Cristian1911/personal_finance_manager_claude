"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedClient, isIgnorableAuthError } from "@/lib/supabase/auth";
import type { Json } from "@/types/database";

export type ProductEventInput = {
  event_name: string;
  session_id?: string;
  platform?: "web" | "mobile";
  entry_point?: string;
  flow?: "onboarding" | "import" | "categorize" | "budget" | "debt" | "dashboard";
  step?: string;
  success?: boolean;
  duration_ms?: number;
  error_code?: string;
  metadata?: Json;
};

type ProductEventInsert = {
  user_id: string;
  event_name: string;
  session_id: string | null;
  platform: "web" | "mobile";
  entry_point: string | null;
  flow: ProductEventInput["flow"] | null;
  step: string | null;
  success: boolean | null;
  duration_ms: number | null;
  error_code: string | null;
  metadata: Json;
};

type ProductEventWriter = {
  from(table: "product_events"): {
    insert(payload: ProductEventInsert): Promise<{ error: { code?: string; message?: string } | null }>;
  };
};

function buildPayload(userId: string, input: ProductEventInput): ProductEventInsert {
  return {
    user_id: userId,
    event_name: input.event_name,
    session_id: input.session_id ?? null,
    platform: input.platform ?? "web",
    entry_point: input.entry_point ?? null,
    flow: input.flow ?? null,
    step: input.step ?? null,
    success: typeof input.success === "boolean" ? input.success : null,
    duration_ms: typeof input.duration_ms === "number" ? input.duration_ms : null,
    error_code: input.error_code ?? null,
    metadata: input.metadata ?? {},
  };
}

async function insertProductEvent(db: ProductEventWriter, payload: ProductEventInsert): Promise<void> {
  const { error } = await db.from("product_events").insert(payload);

  if (!error) return;

  const dbError = error as { code?: string; message?: string };
  if (isIgnorableAuthError(dbError)) return;
  if (dbError.code === "42501") {
    console.warn("trackProductEvent skipped by RLS");
    return;
  }
  console.error("trackProductEvent error:", dbError.message ?? "unknown");
}

export async function trackProductEvent(input: ProductEventInput): Promise<void> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user || !input.event_name) return;

  let db: ProductEventWriter = supabase as unknown as ProductEventWriter;
  try {
    db = createAdminClient() as unknown as ProductEventWriter;
  } catch {
    /* admin client unavailable, fall back to user client */
  }

  await insertProductEvent(db, buildPayload(user.id, input));
}

export async function trackProductEventForUser(
  userId: string,
  input: ProductEventInput
): Promise<void> {
  if (!userId || !input.event_name) return;

  try {
    const db = createAdminClient() as unknown as ProductEventWriter;
    await insertProductEvent(db, buildPayload(userId, input));
  } catch {
    console.warn("trackProductEventForUser skipped: admin client unavailable");
  }
}
