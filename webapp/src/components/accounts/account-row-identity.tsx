import { AccountIcon } from "./account-icon";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type AccountType = Database["public"]["Enums"]["account_type"];

export interface AccountIdentity {
  name: string;
  mask: string | null;
  bank_key: string | null;
  account_type: AccountType;
  color: string | null;
  institution_name?: string | null;
}

interface AccountRowIdentityProps {
  account: AccountIdentity;
  density: "compact" | "picker" | "detail";
  className?: string;
}

const BANK_PREFIX_BY_KEY: Record<string, RegExp> = {
  bancolombia: /^bancolombia\s+/i,
  nu: /^(nu|nubank)\s+/i,
  davivienda: /^davivienda\s+/i,
  falabella: /^falabella\s+/i,
  "banco-de-bogota": /^(banco de )?bogot[aá]\s+/i,
  lulo: /^lulo\s+/i,
  confiar: /^confiar\s+/i,
  popular: /^(banco )?popular\s+/i,
  nequi: /^nequi\s+/i,
};

function trimDisplayName(name: string, bank_key: string | null, mask: string | null): string {
  let out = name.trim();
  const maskRegex = mask ? new RegExp(`\\s*·?\\s*\\*{2,}${mask}\\s*$`) : null;
  if (maskRegex) out = out.replace(maskRegex, "").trim();
  if (bank_key) {
    const prefix = BANK_PREFIX_BY_KEY[bank_key];
    if (prefix) out = out.replace(prefix, "").trim();
  }
  return out.length > 0 ? out : name;
}

export function AccountRowIdentity({ account, density, className }: AccountRowIdentityProps) {
  const showMask = (density === "picker" || density === "detail") && !!account.mask;
  const displayName = trimDisplayName(account.name, account.bank_key, account.mask);

  if (density === "detail") {
    const institution = account.institution_name ?? "";
    const maskLine = account.mask ? `****${account.mask}` : "";
    const separator = institution && maskLine ? " · " : "";
    const ariaLabel = [displayName, institution, maskLine].filter(Boolean).join(", ");
    return (
      <div className={cn("flex items-center gap-3", className)} aria-label={ariaLabel}>
        <AccountIcon
          bank_key={account.bank_key}
          account_type={account.account_type}
          color={account.color}
          size="md"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          {(institution || maskLine) && (
            <p className="truncate text-xs text-muted-foreground">
              {institution}
              {separator}
              {maskLine}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 min-w-0", className)}>
      <AccountIcon
        bank_key={account.bank_key}
        account_type={account.account_type}
        color={account.color}
        size="sm"
      />
      <span className="truncate">{displayName}</span>
      {showMask && (
        <span className="shrink-0 text-muted-foreground">· ****{account.mask}</span>
      )}
    </span>
  );
}
