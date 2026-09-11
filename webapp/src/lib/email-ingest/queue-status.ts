/**
 * Where a queued email alert went once it is no longer pending. Shared by the
 * server actions (which detect it) and the queue hook (which tells the user),
 * so the wording lives in one place. `other` covers a status the client does
 * not know yet — never guess "importada" for it.
 */
export type ProcessedQueueStatus = "imported" | "dismissed" | "other";

const PROCESSED_QUEUE_MESSAGES: Record<ProcessedQueueStatus, string> = {
  imported: "Esta transacción ya se había importado.",
  dismissed: "Esta transacción ya se había descartado.",
  other: "Esta transacción ya no está en la cola.",
};

/** Narrow a raw `pending_email_transactions.status` that is not `pending`. */
export function toProcessedQueueStatus(status: string): ProcessedQueueStatus {
  return status === "imported" || status === "dismissed" ? status : "other";
}

export function processedQueueRowMessage(status: ProcessedQueueStatus): string {
  return PROCESSED_QUEUE_MESSAGES[status];
}

/**
 * Result of a queue mutation. `processed` marks the one failure that is not
 * really one: the row already left the queue elsewhere (another tab, a bulk
 * run, a webhook), so the surface drops it instead of rolling it back.
 */
export type EmailQueueActionResult =
  | { success: true; data: null }
  | { success: false; error: string; processed?: ProcessedQueueStatus };

export function processedQueueResult(status: string): EmailQueueActionResult {
  const processed = toProcessedQueueStatus(status);
  return { success: false, error: processedQueueRowMessage(processed), processed };
}
