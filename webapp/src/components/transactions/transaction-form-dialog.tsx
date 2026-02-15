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
import { Plus } from "lucide-react";
import type { Account, Category, Transaction } from "@/types/domain";

export function TransactionFormDialog({
  transaction,
  accounts,
  categories,
}: {
  transaction?: Transaction;
  accounts: Account[];
  categories: Category[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {transaction ? "Editar" : "Nueva transacción"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {transaction ? "Editar transacción" : "Nueva transacción"}
          </DialogTitle>
        </DialogHeader>
        <TransactionForm
          transaction={transaction}
          accounts={accounts}
          categories={categories}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
