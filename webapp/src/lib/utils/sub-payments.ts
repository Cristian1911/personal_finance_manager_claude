import type { SubPayment } from "@/types/domain";

/**
 * Parse and validate a raw `sub_payments` JSONB value into typed SubPayment[].
 * Returns null if the input is not a valid array or has no valid entries.
 */
export function parseSubPayments(raw: unknown): SubPayment[] | null {
  if (!Array.isArray(raw)) return null;
  const result = raw.filter(
    (e): e is SubPayment =>
      typeof e === "object" &&
      e !== null &&
      typeof (e as Record<string, unknown>).currency_code === "string" &&
      typeof (e as Record<string, unknown>).amount === "number" &&
      ((e as Record<string, unknown>).amount as number) > 0,
  );
  return result.length > 0 ? result : null;
}
