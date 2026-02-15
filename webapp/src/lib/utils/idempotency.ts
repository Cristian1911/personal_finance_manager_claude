export async function computeIdempotencyKey(params: {
  provider: string;
  providerTransactionId?: string;
  transactionDate: string;
  amount: number;
  rawDescription?: string;
}): Promise<string> {
  const payload = [
    params.provider,
    params.providerTransactionId ?? "",
    params.transactionDate,
    params.amount.toFixed(2),
    params.rawDescription ?? "",
  ].join("|");

  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
