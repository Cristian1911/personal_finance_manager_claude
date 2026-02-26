"use server";

import { createClient } from "@/lib/supabase/server";
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

export async function trackProductEvent(input: ProductEventInput): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !input.event_name) return;

  const payload = {
    user_id: user.id,
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

  const { error } = await supabase.from("product_events").insert(payload);
  if (error) {
    console.error("trackProductEvent error:", error.message);
  }
}
