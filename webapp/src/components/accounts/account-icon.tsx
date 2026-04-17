import {
  Wallet,
  PiggyBank,
  CreditCard,
  Landmark,
  Banknote,
  TrendingUp,
} from "lucide-react";
import { BANK_LOGOS } from "@/lib/icons/bank-logos";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type AccountType = Database["public"]["Enums"]["account_type"];

const TYPE_GLYPHS: Record<AccountType, React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>> = {
  CHECKING: Wallet,
  SAVINGS: PiggyBank,
  CREDIT_CARD: CreditCard,
  LOAN: Landmark,
  CASH: Banknote,
  INVESTMENT: TrendingUp,
  OTHER: Wallet,
};

interface AccountIconProps {
  bank_key: string | null;
  account_type: AccountType;
  color?: string | null;
  size?: "sm" | "md";
  className?: string;
}

export function AccountIcon({
  bank_key,
  account_type,
  color,
  size = "sm",
  className,
}: AccountIconProps) {
  const dim = size === "sm" ? "size-4" : "size-6";
  const BankLogo = bank_key ? BANK_LOGOS[bank_key] : undefined;

  if (BankLogo) {
    return <BankLogo className={cn(dim, className)} aria-hidden />;
  }

  const Glyph = TYPE_GLYPHS[account_type] ?? Wallet;
  const wrapDim = size === "sm" ? "size-5" : "size-7";
  const iconDim = size === "sm" ? "size-3.5" : "size-5";
  const tintStyle = color ? { backgroundColor: `${color}1a`, color } : undefined;

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md",
        wrapDim,
        !color && "bg-white/5 text-muted-foreground",
        className,
      )}
      style={tintStyle}
    >
      <Glyph className={iconDim} aria-hidden />
    </span>
  );
}
