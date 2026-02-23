export async function computeIdempotencyKey(params: {
  provider: string;
  providerTransactionId?: string;
  transactionDate: string;
  amount: number;
  rawDescription?: string;
  installmentCurrent?: number | null;
}): Promise<string> {
  const payload = [
    params.provider,
    params.providerTransactionId ?? "",
    params.transactionDate,
    params.amount.toFixed(2),
    params.rawDescription ?? "",
    params.installmentCurrent != null ? String(params.installmentCurrent) : "",
  ].join("|");

  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function computeInstallmentGroupId(params: {
  accountId: string;
  rawDescription: string;
  amount: number;
}): Promise<string> {
  const payload = [
    params.accountId,
    params.rawDescription.trim().toUpperCase(),
    params.amount.toFixed(2),
  ].join("|");

  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return "ig_" + hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
