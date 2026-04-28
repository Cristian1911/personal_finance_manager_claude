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
import { SpecializedAccountForm } from "./specialized-account-form";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/domain";

export function AccountFormDialog({
  account,
  triggerLabel,
  triggerClassName,
}: {
  account?: Account;
  triggerLabel?: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const label = triggerLabel ?? (account ? "Editar" : "Nueva cuenta");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className={cn(triggerClassName)}>
          <Plus className="h-4 w-4 mr-2" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {account ? "Editar cuenta" : "Nueva cuenta"}
          </DialogTitle>
        </DialogHeader>
        <SpecializedAccountForm account={account} onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
