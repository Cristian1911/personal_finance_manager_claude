import type { ParsedEmailTransaction } from "@/lib/parsers/bancolombia-email";
import type { AccountType } from "@/types/domain";
import {
  accountMaskSuffixMatches,
  normalizeAccountMaskSuffix,
} from "../utils/account-mask";

type AccountMatchCandidate = {
  id: string;
  debit_card_mask: string | null;
  mask: string | null;
  account_type: AccountType;
};

const ACCOUNT_TYPE_PREFERENCES: Record<
  ParsedEmailTransaction["card_type"],
  AccountType[]
> = {
  "T.Cred": ["CREDIT_CARD"],
  "T.Deb": ["SAVINGS", "CHECKING"],
  Cta: ["SAVINGS", "CHECKING"],
  producto: ["SAVINGS", "CHECKING"],
};

interface ResolveSuggestedEmailAccountParams {
  accounts: AccountMatchCandidate[];
  parsed: ParsedEmailTransaction;
  defaultAccountId?: string | null;
}

export function resolveSuggestedEmailAccountId({
  accounts,
  parsed,
  defaultAccountId,
}: ResolveSuggestedEmailAccountParams): string | null {
  const defaultAccount =
    defaultAccountId == null
      ? null
      : accounts.find((account) => account.id === defaultAccountId) ?? null;
  const last4 = normalizeAccountMaskSuffix(parsed.card_last4);

  if (!last4) {
    return defaultAccount?.id ?? null;
  }

  const exactMatches = accounts.filter((account) => {
    if (!ACCOUNT_TYPE_PREFERENCES[parsed.card_type].includes(account.account_type)) {
      return false;
    }

    if (parsed.card_type === "T.Deb") {
      return accountMaskSuffixMatches(account.debit_card_mask, last4);
    }

    return accountMaskSuffixMatches(account.mask, last4);
  });

  if (exactMatches.length === 0) {
    return defaultAccount?.id ?? null;
  }

  if (exactMatches.length === 1) {
    return exactMatches[0].id;
  }

  return exactMatches.find((account) => account.id === defaultAccount?.id)?.id ?? null;
}
