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

export function AccountRowIdentity({ account, density, className }: AccountRowIdentityProps) {
  const showMask = (density === "picker" || density === "detail") && !!account.mask;

  if (density === "detail") {
    const institution = account.institution_name ?? "";
    const maskLine = account.mask ? `****${account.mask}` : "";
    const separator = institution && maskLine ? " · " : "";
    return (
      <div className={cn("flex items-center gap-3", className)}>
        <AccountIcon
          bank_key={account.bank_key}
          account_type={account.account_type}
          color={account.color}
          size="md"
        />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{account.name}</p>
          {(institution || maskLine) && (
            <p className="truncate text-[11px] text-muted-foreground">
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
      <span className="truncate">{account.name}</span>
      {showMask && (
        <span className="shrink-0 text-muted-foreground">· ****{account.mask}</span>
      )}
    </span>
  );
}
