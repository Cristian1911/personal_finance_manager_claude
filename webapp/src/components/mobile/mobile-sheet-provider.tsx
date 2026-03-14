"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CalendarPlus, Landmark } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  FabMenu,
  type PrimaryAction,
  type ContextAction,
} from "./fab-menu";
import { MobileTransactionForm } from "./mobile-transaction-form";
import { RecurringForm } from "@/components/recurring/recurring-form";
import { SpecializedAccountForm } from "@/components/accounts/specialized-account-form";
import type {
  Account,
  CategoryWithChildren,
} from "@/types/domain";

interface MobileSheetProviderProps {
  accounts: Account[];
  categories: CategoryWithChildren[];
  children: React.ReactNode;
}

// Active sheet can be a primary action that opens a sheet, or a context action
type ActiveSheet = "transaction" | "new-recurring" | "new-account" | null;

function getSheetTitle(sheet: ActiveSheet): string {
  switch (sheet) {
    case "transaction":
      return "Nueva transacción";
    case "new-recurring":
      return "Nueva transacción recurrente";
    case "new-account":
      return "Nueva cuenta";
    default:
      return "";
  }
}

function getContextActions(pathname: string): ContextAction[] {
  if (pathname.startsWith("/recurrentes")) {
    return [
      {
        id: "new-recurring",
        icon: <CalendarPlus className="size-4" />,
        label: "Nuevo recurrente",
        description: "Plantilla de gasto o ingreso fijo",
      },
    ];
  }
  if (pathname === "/accounts") {
    return [
      {
        id: "new-account",
        icon: <Landmark className="size-4" />,
        label: "Nueva cuenta",
        description: "Cuenta bancaria o tarjeta",
      },
    ];
  }
  return [];
}

export function MobileSheetProvider({
  accounts,
  categories,
  children,
}: MobileSheetProviderProps) {
  const [activeSheet, setActiveSheet] = useState<ActiveSheet>(null);
  const pathname = usePathname();
  const router = useRouter();

  const contextActions = getContextActions(pathname);

  function handlePrimaryAction(action: PrimaryAction) {
    if (action === "transaction") {
      setActiveSheet("transaction");
    } else if (action === "import-pdf") {
      // Navigate to import page — no sheet needed
      router.push("/import");
    }
  }

  function handleContextAction(id: string) {
    if (id === "new-recurring" || id === "new-account") {
      setActiveSheet(id);
    }
  }

  return (
    <>
      {children}

      <FabMenu
        onPrimaryAction={handlePrimaryAction}
        contextActions={contextActions}
        onContextAction={handleContextAction}
      />

      <Sheet
        open={activeSheet !== null}
        onOpenChange={(open) => {
          if (!open) setActiveSheet(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="max-h-[85vh] overflow-y-auto rounded-t-2xl"
        >
          <SheetHeader>
            <SheetTitle>
              {activeSheet ? getSheetTitle(activeSheet) : ""}
            </SheetTitle>
          </SheetHeader>

          <div className="px-4 pb-4">
            {activeSheet === "transaction" && (
              <MobileTransactionForm
                key="transaction"
                accounts={accounts}
                categories={categories}
                onSuccess={() => setActiveSheet(null)}
              />
            )}

            {activeSheet === "new-recurring" && (
              <RecurringForm
                accounts={accounts}
                categories={categories}
                onSuccess={() => setActiveSheet(null)}
              />
            )}

            {activeSheet === "new-account" && (
              <SpecializedAccountForm
                onSuccess={() => setActiveSheet(null)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
