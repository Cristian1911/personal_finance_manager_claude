import type { SplitErrorReason } from "@zeta/shared";

/**
 * User-facing Spanish text for every failure `computeSplit` can report. Lives in
 * a plain module (not in a `"use server"` file) so both the shared-payment and
 * the split-a-debt actions can import the same map — a `"use server"` module may
 * only export async functions.
 */
export const SPLIT_ERROR_MESSAGES: Record<SplitErrorReason, string> = {
  no_participants: "Agrega al menos una persona",
  invalid_total: "El monto total no es válido",
  negative_value: "Los valores no pueden ser negativos",
  amount_sum_exceeds_total: "Las partes asignadas superan el total del pago",
  amount_sum_mismatch: "Las partes deben sumar exactamente el total del pago",
  percent_out_of_range: "Los porcentajes superan el 100%",
  percent_sum_mismatch: "Los porcentajes deben sumar 100%",
};
