export function applyVisibleTransactionFilter<T extends { is: (...args: unknown[]) => T }>(
  query: T
): T {
  return query.is("reconciled_into_transaction_id", null) as T;
}
