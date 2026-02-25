export type HashFn = (payload: string) => Promise<string>;

async function sha256(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(payload);
  const hashBuffer = await globalThis.crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function computeIdempotencyKey(
  params: {
    provider: string;
    providerTransactionId?: string;
    transactionDate: string;
    amount: number;
    rawDescription?: string;
    installmentCurrent?: number | null;
  },
  hashFn: HashFn = sha256
): Promise<string> {
  const payload = [
    params.provider,
    params.providerTransactionId ?? "",
    params.transactionDate,
    params.amount.toFixed(2),
    params.rawDescription ?? "",
    params.installmentCurrent != null ? String(params.installmentCurrent) : "",
  ].join("|");

  return hashFn(payload);
}

export async function computeInstallmentGroupId(
  params: {
    accountId: string;
    rawDescription: string;
    amount: number;
  },
  hashFn: HashFn = sha256
): Promise<string> {
  const payload = [
    params.accountId,
    params.rawDescription.trim().toUpperCase(),
    params.amount.toFixed(2),
  ].join("|");

  return "ig_" + (await hashFn(payload));
}
