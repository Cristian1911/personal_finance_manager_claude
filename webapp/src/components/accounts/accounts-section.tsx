"use client";

import Link from "next/link";
import { useAccounts } from "@/components/providers/app-data-provider";
import { AccountEntityRow } from "@/components/accounts/account-entity-row";
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

export function AccountsSection({
  hideDebt = false,
  today,
}: {
  hideDebt?: boolean;
  /** YYYY-MM-DD calculado en el servidor. Este componente es cliente y no
   *  puede leer el reloj durante el render sin romper la hidratación. */
  today: string;
}) {
  const accounts = useAccounts();

  if (accounts.length === 0) return null;

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
          <div className="space-y-2">
            {group.accounts.map((account) => (
              <AccountEntityRow key={account.id} account={account} today={today} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
