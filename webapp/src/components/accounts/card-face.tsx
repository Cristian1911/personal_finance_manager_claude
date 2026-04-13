import { formatCurrency } from "@/lib/utils/currency";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/domain";
import type { CurrencyCode } from "@/types/domain";

const INSTITUTION_GRADIENTS: Record<string, string> = {
  bancolombia:
    "bg-gradient-to-br from-[#2d3a2a] via-[#3f4632] to-[#8b7a3a]",
  nequi:
    "bg-gradient-to-br from-[#2a1040] via-[#45186e] to-[#c0408a]",
  davivienda:
    "bg-gradient-to-br from-[#3a1010] via-[#6e1818] to-[#c42020]",
  nu: "bg-gradient-to-br from-[#3a1a60] via-[#6b30a0] to-[#a060d0]",
  "banco de bogota":
    "bg-gradient-to-br from-[#0a1a3a] via-[#183060] to-[#2850a0]",
  falabella:
    "bg-gradient-to-br from-[#1a2a1a] via-[#2a4a2a] to-[#4a8a3a]",
  lulo: "bg-gradient-to-br from-[#1a0a2a] via-[#3a1a5a] to-[#6a30a0]",
};

const FALLBACK_GRADIENT =
  "bg-gradient-to-br from-[#1a1a1a] via-[#252525] to-[#333]";

const ACCOUNT_TYPE_CARD_LABELS: Record<string, string> = {
  CREDIT_CARD: "CRÉDITO",
  SAVINGS: "AHORROS",
  CHECKING: "DÉBITO",
  CASH: "EFECTIVO",
  INVESTMENT: "INVERSIÓN",
  LOAN: "PRÉSTAMO",
  OTHER: "CUENTA",
};

interface CardFaceProps {
  account: Account;
}

export function CardFace({ account }: CardFaceProps) {
  const institutionKey = (account.institution_name ?? "")
    .toLowerCase()
    .trim();
  const gradient =
    (institutionKey ? INSTITUTION_GRADIENTS[institutionKey] : undefined) ??
    FALLBACK_GRADIENT;
  const mask = account.debit_card_mask ?? account.mask;
  const typeLabel =
    (account.account_type
      ? ACCOUNT_TYPE_CARD_LABELS[account.account_type]
      : undefined) ?? "CUENTA";

  return (
    <div
      className={cn(
        "aspect-[85.6/53.98] w-full rounded-xl p-4 flex flex-col justify-between select-none",
        gradient
      )}
    >
      {/* Top row */}
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-white/70 uppercase tracking-wider">
          {account.institution_name ?? ""}
        </span>
        <span className="text-[10px] font-semibold text-white/50 uppercase tracking-widest">
          {typeLabel}
        </span>
      </div>

      {/* Center balance */}
      <div className="flex-1 flex items-center">
        <span className="text-xl font-bold text-white tracking-tight">
          {formatCurrency(
            account.current_balance ?? 0,
            (account.currency_code ?? "COP") as CurrencyCode
          )}
        </span>
      </div>

      {/* Bottom row */}
      <div className="flex items-end justify-between">
        <span className="text-sm font-mono text-white/60 tracking-widest">
          {mask ? `•••• ${mask}` : "••••"}
        </span>
        <span className="text-xs font-medium text-white/40">
          {account.currency_code}
        </span>
      </div>
    </div>
  );
}
