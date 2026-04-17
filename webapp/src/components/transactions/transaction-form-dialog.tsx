"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TransactionForm } from "./transaction-form";
import { Pencil, Plus } from "lucide-react";
import { GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import type { Account, CategoryWithChildren, Tag, Transaction } from "@/types/domain";

export function TransactionFormDialog({
  transaction,
  accounts,
  categories,
  tags,
}: {
  transaction?: Transaction;
  accounts: Account[];
  categories: CategoryWithChildren[];
  tags?: Tag[];
}) {
  const [open, setOpen] = useState(false);
  const isEdit = !!transaction;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={isEdit ? GHOST_BUTTON_CLASS : undefined}>
          {isEdit ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {isEdit ? "Editar" : "Nueva transacción"}
        </Button>
      </DialogTrigger>
      <DialogContent className="flex max-h-[85svh] flex-col overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="shrink-0 px-4 pt-4 sm:px-6 sm:pt-6">
          <DialogTitle>
            {transaction ? "Editar transacción" : "Nueva transacción"}
          </DialogTitle>
        </DialogHeader>
        <div className="min-h-0 overflow-y-auto px-4 pb-4 sm:px-6 sm:pb-6">
          <TransactionForm
            transaction={transaction}
            accounts={accounts}
            categories={categories}
            tags={tags}
            onSuccess={() => setOpen(false)}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
