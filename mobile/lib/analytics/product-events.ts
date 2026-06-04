import { supabase } from "../supabase";

/**
 * Mobile product analytics — mirrors the webapp `trackProductEvent`
 * (webapp/src/actions/product-events.ts) so both platforms write the same rows
 * to the shared `product_events` table. The Expo app had ZERO funnel tracking;
 * this lets activation (onboarding → first transaction → first import) be
 * measured on the actual store artifact.
 *
 * Fire-and-forget + best-effort: never throws, never blocks the UI. If offline,
 * unauthenticated, or RLS-denied, the event is silently dropped. RLS allows the
 * insert (`product_events` policy: with check auth.uid() = user_id).
 */
export type ProductEventInput = {
  event_name: string;
  entry_point?: string;
  flow?: "onboarding" | "import" | "categorize" | "budget" | "debt" | "dashboard";
  step?: string;
  success?: boolean;
  duration_ms?: number;
  error_code?: string;
  metadata?: Record<string, unknown>;
};

type ProductEventInsert = {
  user_id: string;
  event_name: string;
  session_id: string;
  platform: "mobile";
  entry_point: string | null;
  flow: ProductEventInput["flow"] | null;
  step: string | null;
  success: boolean | null;
  duration_ms: number | null;
  error_code: string | null;
  metadata: Record<string, unknown>;
};

// `product_events` is intentionally NOT in the generated @zeta/shared Database
// type, so cast to a minimal writer (same approach as the webapp action).
type ProductEventWriter = {
  from(table: "product_events"): {
    insert(payload: ProductEventInsert): Promise<{ error: unknown }>;
  };
};

// One id per app launch so events can be grouped into a session.
const SESSION_ID = `m_${Date.now().toString(36)}_${Math.random()
  .toString(36)
  .slice(2, 10)}`;

export function trackProductEvent(input: ProductEventInput): void {
  if (!input.event_name) return;
  void (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const userId = data.session?.user?.id;
      if (!userId) return;
      const db = supabase as unknown as ProductEventWriter;
      await db.from("product_events").insert({
        user_id: userId,
        event_name: input.event_name,
        session_id: SESSION_ID,
        platform: "mobile",
        entry_point: input.entry_point ?? null,
        flow: input.flow ?? null,
        step: input.step ?? null,
        success: typeof input.success === "boolean" ? input.success : null,
        duration_ms:
          typeof input.duration_ms === "number" ? input.duration_ms : null,
        error_code: input.error_code ?? null,
        metadata: input.metadata ?? {},
      });
    } catch {
      /* best-effort telemetry — never block or throw */
    }
  })();
}
