export function dedupeTransactionIds(
  rows: { transaction_id: string }[],
): string[] {
  return [...new Set(rows.map((r) => r.transaction_id))];
}
