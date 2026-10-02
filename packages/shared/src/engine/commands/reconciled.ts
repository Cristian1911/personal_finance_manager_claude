import type { StoragePort, TransactionRow } from "../types";

/** Held for Revisar: a bank movement that may be `reconciledIntoTransactionId` (doesn't count yet). */
export const isHeld = (t: TransactionRow) => t.status === "PENDING" && !!t.reconciledIntoTransactionId;
/** Merged into a bank's row: that row is the movement now. */
export const isMerged = (t: TransactionRow) => t.status !== "PENDING" && !!t.reconciledIntoTransactionId;

/**
 * The row a label (category, note, destinatario) should land on: a phone that
 * hasn't pulled a merge yet still edits what it anotó; the bank's row carries it now.
 */
export async function labelTarget(s: StoragePort, userId: string, tx: TransactionRow): Promise<TransactionRow> {
  let t = tx;
  for (let hops = 0; isMerged(t) && hops < 5; hops++) {
    const next = await s.getTransaction(userId, t.reconciledIntoTransactionId!);
    if (!next) break;
    t = next;
  }
  return t;
}

export const HELD_ERROR = "Este movimiento está esperando tu respuesta en Revisar.";
