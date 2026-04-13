"use server";

import type { ActionResult } from "@/types/actions";

/**
 * Create a transfer between two accounts.
 * Stub — full implementation is being created in parallel.
 */
export async function createTransfer(
  _prevState: ActionResult<void>,
  formData: FormData
): Promise<ActionResult<void>> {
  const fromAccountId = formData.get("fromAccountId") as string;
  const toAccountId = formData.get("toAccountId") as string;
  const amount = parseFloat(formData.get("amount") as string);

  if (!fromAccountId || !toAccountId || isNaN(amount) || amount <= 0) {
    return { success: false, error: "Datos incompletos" };
  }

  // TODO: implement full transfer logic
  return { success: false, error: "Transferencias aún no implementadas" };
}
