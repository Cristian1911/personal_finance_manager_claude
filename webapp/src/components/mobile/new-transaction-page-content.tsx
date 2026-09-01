"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAccounts, useCategories } from "@/components/providers/app-data-provider";
import { MobileTransactionForm } from "./mobile-transaction-form";
import type { TransactionDirection } from "@/types/domain";

const TYPE_MAP: Record<string, { direction: TransactionDirection; isTransfer?: boolean }> = {
  expense: { direction: "OUTFLOW" },
  income: { direction: "INFLOW" },
  transfer: { direction: "OUTFLOW", isTransfer: true },
};

export function NewTransactionPageContent() {
  const accounts = useAccounts();
  const categories = useCategories();
  const router = useRouter();
  const searchParams = useSearchParams();

  const typeParam = searchParams.get("type");
  const preset = typeParam ? TYPE_MAP[typeParam] : undefined;
  // Deep link from a specific account ("Agregar movimiento" on /accounts/[id]).
  const accountParam = searchParams.get("account") ?? undefined;

  // Issue #387: re-entering /transactions/new from the FAB right after a save
  // showed the previous description/category/notes. The client Router Cache
  // can hand back this page with its React state intact, so a saved form
  // must never be trusted to remount on its own — bumping the key forces a
  // fresh form for the next capture.
  const [formKey, setFormKey] = useState(0);

  const handleSuccess = useCallback(() => {
    setFormKey((k) => k + 1);
    toast.success("Guardado");
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/dashboard");
    }
  }, [router]);

  return (
    <MobileTransactionForm
      key={formKey}
      accounts={accounts}
      categories={categories}
      defaultDirection={preset?.direction}
      isTransfer={preset?.isTransfer}
      defaultAccountId={accountParam}
      onSuccess={handleSuccess}
    />
  );
}
