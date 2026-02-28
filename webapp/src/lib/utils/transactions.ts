export function applyVisibleTransactionFilter(query: any): any {
  return query.is("reconciled_into_transaction_id", null);
}

export function isMissingReconciliationColumnError(
  error: unknown
): error is { code?: string; message?: string } {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "42703" &&
    candidate.message?.includes("reconciled_into_transaction_id") === true
  );
}

export async function executeVisibleTransactionQuery(
  buildQuery: () => any
): Promise<any> {
  const result = await applyVisibleTransactionFilter(buildQuery());
  if (isMissingReconciliationColumnError((result as { error?: unknown }).error)) {
    return await buildQuery();
  }
  return result;
}
