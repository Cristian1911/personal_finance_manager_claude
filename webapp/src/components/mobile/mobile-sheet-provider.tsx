"use client";

import { useState, useMemo, useCallback } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, Landmark } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { FabMenu, type FabAction, type ContextAction } from "./fab-menu";
import { MobileTransactionForm } from "./mobile-transaction-form";
import { RecurringForm } from "@/components/recurring/recurring-form";
import { SpecializedAccountForm } from "@/components/accounts/specialized-account-form";
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

const TRANSACTION_ACTIONS: Record<
  "expense" | "income" | "transfer",
  { title: string; direction: TransactionDirection }
> = {
  expense: { title: "Gasto rápido", direction: "OUTFLOW" },
  income: { title: "Ingreso", direction: "INFLOW" },
  transfer: { title: "Transferencia", direction: "OUTFLOW" },
};

function getContextActions(pathname: string): ContextAction[] {
  // startsWith: no sub-routes for recurrentes
  // exact match: avoid showing on /accounts/[id] detail pages
  if (pathname.startsWith("/recurrentes")) {
    return [{ id: "new-recurring", label: "Nuevo recurrente", icon: CalendarPlus, bg: "bg-purple-500" }];
  }
  if (pathname === "/accounts") {
    return [{ id: "new-account", label: "Nueva cuenta", icon: Landmark, bg: "bg-cyan-500" }];
  }
  return [];
}

function getSheetTitle(action: FabAction): string {
  if (action === "new-recurring") return "Nueva transaccion recurrente";
  if (action === "new-account") return "Nueva cuenta";
  return TRANSACTION_ACTIONS[action as keyof typeof TRANSACTION_ACTIONS]?.title ?? "";
}

export function MobileSheetProvider({
  accounts,
  categories,
  children,
}: MobileSheetProviderProps) {
  const [activeAction, setActiveAction] = useState<FabAction | null>(null);
  const pathname = usePathname();

  const contextActions = useMemo(() => getContextActions(pathname), [pathname]);

  const handleSuccess = useCallback(() => {
    setActiveAction(null);
    toast.success("Guardado");
  }, []);

  return (
    <>
      {children}

      <FabMenu onAction={setActiveAction} contextActions={contextActions} />

      <Drawer
        open={activeAction !== null}
        onOpenChange={(open) => {
          if (!open) setActiveAction(null);
        }}
      >
        <DrawerContent className="max-h-[85svh] overflow-hidden">
          <DrawerHeader className="shrink-0">
            <DrawerTitle>{activeAction ? getSheetTitle(activeAction) : ""}</DrawerTitle>
          </DrawerHeader>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {activeAction && activeAction in TRANSACTION_ACTIONS && (
              <MobileTransactionForm
                key={activeAction}
                accounts={accounts}
                categories={categories}
                defaultDirection={TRANSACTION_ACTIONS[activeAction as keyof typeof TRANSACTION_ACTIONS].direction}
                isTransfer={activeAction === "transfer"}
                onSuccess={handleSuccess}
              />
            )}

            {activeAction === "new-recurring" && (
              <RecurringForm
                accounts={accounts}
                categories={categories}
                onSuccess={handleSuccess}
              />
            )}

            {activeAction === "new-account" && (
              <SpecializedAccountForm
                onSuccess={handleSuccess}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
