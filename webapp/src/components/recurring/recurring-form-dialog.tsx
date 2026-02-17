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
import { RecurringForm } from "./recurring-form";
import { Plus } from "lucide-react";
import type { Account, CategoryWithChildren, RecurringTemplate } from "@/types/domain";

export function RecurringFormDialog({
  template,
  accounts,
  categories,
  trigger,
}: {
  template?: RecurringTemplate;
  accounts: Account[];
  categories: CategoryWithChildren[];
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nueva recurrente
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? "Editar recurrente" : "Nueva transacción recurrente"}
          </DialogTitle>
        </DialogHeader>
        <RecurringForm
          template={template}
          accounts={accounts}
          categories={categories}
          onSuccess={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
