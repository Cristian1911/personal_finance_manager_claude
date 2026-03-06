import * as SecureStore from "expo-secure-store";

const PDF_PASSWORD_KEY_PREFIX = "venti5_pdf_password";

function getPdfPasswordKey(userId: string, accountId: string) {
  const sanitized = `${userId}_${accountId}`.replace(/[^a-zA-Z0-9.,_]/g, "_");
  return `${PDF_PASSWORD_KEY_PREFIX}_${sanitized}`;
}

export async function getPdfPasswordForAccount(
  userId: string,
  accountId: string
): Promise<string | null> {
  return SecureStore.getItemAsync(getPdfPasswordKey(userId, accountId));
}

export async function setPdfPasswordForAccount(
  userId: string,
  accountId: string,
  password: string | null
): Promise<void> {
  const key = getPdfPasswordKey(userId, accountId);
  const normalized = password?.trim() ?? "";

  if (!normalized) {
    await SecureStore.deleteItemAsync(key).catch(() => {});
    return;
  }

  await SecureStore.setItemAsync(key, normalized);
}

export async function getSavedPdfPasswordsForAccounts(
  userId: string,
  accounts: Array<{ id: string; name: string }>
): Promise<Array<{ accountId: string; accountName: string; password: string }>> {
  const saved = await Promise.all(
    accounts.map(async (account) => {
      const password = await getPdfPasswordForAccount(userId, account.id);
      if (!password) return null;

      return {
        accountId: account.id,
        accountName: account.name,
        password,
      };
    })
  );

  return saved.filter(
    (
      entry
    ): entry is { accountId: string; accountName: string; password: string } =>
      entry !== null
  );
}
