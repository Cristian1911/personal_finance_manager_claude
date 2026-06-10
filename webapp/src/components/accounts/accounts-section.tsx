"use client";

import Link from "next/link";
import { useAccounts } from "@/components/providers/app-data-provider";
import { AccountCard } from "@/components/accounts/account-card";
import { SectionEyebrow } from "@/components/ui/section-eyebrow";
import { ArrowRight } from "lucide-react";
import type { AccountType } from "@/types/domain";

/** Display groups in render order. OTHER is intentionally excluded. */
const ACCOUNT_GROUPS: { label: string; types: AccountType[]; isDebt: boolean }[] = [
  { label: "Liquidez", types: ["CHECKING", "CASH"], isDebt: false },
  { label: "Ahorro e inversión", types: ["SAVINGS", "INVESTMENT"], isDebt: false },
  { label: "Tarjetas de crédito", types: ["CREDIT_CARD"], isDebt: true },
  { label: "Préstamos", types: ["LOAN"], isDebt: true },
];

export function AccountsSection({ hideDebt = false }: { hideDebt?: boolean }) {
  const accounts = useAccounts();

  if (accounts.length === 0) return null;

  const allMinimal = accounts.map((a) => ({
    id: a.id,
    name: a.name,
    account_type: a.account_type,
    currency_code: a.currency_code,
  }));

  const groups = ACCOUNT_GROUPS
    .filter((g) => !(hideDebt && g.isDebt))
    .map((g) => ({
      ...g,
      accounts: accounts.filter((a) => g.types.includes(a.account_type)),
    }))
    .filter((g) => g.accounts.length > 0);

  if (groups.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionEyebrow>Mis cuentas</SectionEyebrow>
        <Link
          href="/accounts"
          className="inline-flex items-center gap-1 text-xs font-medium text-z-brass hover:underline"
        >
          Ver todas
          <ArrowRight className="size-3" />
        </Link>
      </div>

      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 text-xs font-medium text-z-sage-dark">{group.label}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {group.accounts.map((account) => (
              <AccountCard key={account.id} account={account} allAccounts={allMinimal} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
