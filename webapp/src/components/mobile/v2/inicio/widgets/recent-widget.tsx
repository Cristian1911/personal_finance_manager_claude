"use client";

import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrencyCompact } from "@/lib/utils/currency";
import { ChipEyebrow } from "../widget-chip";
import { InicioActivity } from "../inicio-activity";
import type { WidgetRender } from "../widget-grid";
import type { CurrencyCode } from "@/types/domain";

type AccountType =
  | "CHECKING"
  | "SAVINGS"
  | "CREDIT_CARD"
  | "CASH"
  | "INVESTMENT"
  | "LOAN"
  | "OTHER";

export interface RecentActivityTx {
  id: string;
  description: string;
  amount: number;
  currency_code: CurrencyCode;
  direction: "INFLOW" | "OUTFLOW";
  transaction_date: string;
  account_id: string;
  account_name: string;
  account_color: string | null;
  account_mask: string | null;
  account_bank_key: string | null;
  account_type: AccountType;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  destinatario_id: string | null;
  destinatario_name: string | null;
  recurrence_group_id: string | null;
  personal_debt_id: string | null;
  transfer_group_id: string | null;
  tags: Array<{
    id: string;
    name: string;
    color: string | null;
    group_color: string | null;
  }>;
}

interface RecentWidgetProps {
  transactions: RecentActivityTx[];
}

export function renderRecentWidget(props: RecentWidgetProps): WidgetRender {
  const { transactions } = props;
  const preview = transactions.slice(0, 3);

  return {
    tone: "foreground",
    accessibilityLabel:
      transactions.length > 0
        ? `Movimientos recientes: ${transactions.length}`
        : "Sin movimientos recientes",
    chip: (
      <div className="flex h-full flex-col gap-1.5">
        <ChipEyebrow>Reciente</ChipEyebrow>
        {preview.length === 0 ? (
          <p className="flex-1 text-[11px] text-muted-foreground">
            Sin movimientos aún
          </p>
        ) : (
          <ul className="flex flex-1 flex-col gap-1.5">
            {preview.map((tx) => (
              <li key={tx.id} className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "flex size-[18px] shrink-0 items-center justify-center rounded-md",
                    tx.direction === "INFLOW"
                      ? "bg-z-income/12 text-z-income"
                      : "bg-z-expense/12 text-z-expense",
                  )}
                >
                  {tx.direction === "INFLOW" ? (
                    <ArrowDownLeft className="size-2.5" />
                  ) : (
                    <ArrowUpRight className="size-2.5" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-[11px] text-foreground">
                  {tx.description}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[10px] font-semibold tabular-nums",
                    tx.direction === "INFLOW"
                      ? "text-z-income"
                      : "text-foreground",
                  )}
                >
                  {tx.direction === "INFLOW" ? "+" : "-"}
                  {formatCurrencyCompact(tx.amount, tx.currency_code)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    ),
    detail:
      transactions.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Aún no hay movimientos que mostrar aquí.
        </p>
      ) : (
        <InicioActivity transactions={transactions} />
      ),
  };
}
