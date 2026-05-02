import * as Crypto from "expo-crypto";

// Mirrors webapp `computeRecurringGroupUuid` in
// `webapp/src/actions/recurring-templates.ts`. Both sides MUST produce the
// same UUID for the same (templateId, occurrenceDate) pair so that
// recurrence_group_id matches between system-created and manually-linked
// transactions.
export async function computeRecurringGroupUuid(
  templateId: string,
  occurrenceDate: string,
): Promise<string> {
  const payload = `${templateId}|${occurrenceDate}`;
  const hex = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    payload,
  );

  const bytes: number[] = [];
  for (let i = 0; i < 32; i += 2) {
    bytes.push(parseInt(hex.slice(i, i + 2), 16));
  }

  // Force RFC-compatible version/variant bits so Postgres UUID parsing accepts it.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const out = bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${out.slice(0, 8)}-${out.slice(8, 12)}-${out.slice(12, 16)}-${out.slice(16, 20)}-${out.slice(20, 32)}`;
}
