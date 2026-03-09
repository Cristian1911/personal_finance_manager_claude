"use client";

import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { FabMenu, type FabAction } from "./fab-menu";
import { MobileTransactionForm } from "./mobile-transaction-form";
import type {
  Account,
  CategoryWithChildren,
  TransactionDirection,
} from "@/types/domain";

interface MobileSheetProviderProps {
  accounts: Account[];
  categories: CategoryWithChildren[];
  children: React.ReactNode;
}

const ACTION_CONFIG: Record<
  FabAction,
  { title: string; direction: TransactionDirection }
> = {
  expense: { title: "Gasto rápido", direction: "OUTFLOW" },
  income: { title: "Ingreso", direction: "INFLOW" },
  transfer: { title: "Transferencia", direction: "OUTFLOW" },
};

export function MobileSheetProvider({
  accounts,
  categories,
  children,
}: MobileSheetProviderProps) {
  const [activeAction, setActiveAction] = useState<FabAction | null>(null);

  const config = activeAction ? ACTION_CONFIG[activeAction] : null;

  return (
    <>
      {children}

      <FabMenu onAction={setActiveAction} />

      <Sheet
        open={activeAction !== null}
        onOpenChange={(open) => {
          if (!open) setActiveAction(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl"
        >
          <SheetHeader>
            <SheetTitle>{config?.title ?? ""}</SheetTitle>
          </SheetHeader>

          {config && (
            <div className="px-4 pb-4">
              <MobileTransactionForm
                key={activeAction}
                accounts={accounts}
                categories={categories}
                defaultDirection={config.direction}
                isTransfer={activeAction === "transfer"}
                onSuccess={() => setActiveAction(null)}
              />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
