"use client";

import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { SpecializedAccountForm } from "./specialized-account-form";
import { Plus } from "lucide-react";
import type { Account } from "@/types/domain";

export function AccountFormDialog({
  account,
  trigger,
}: {
  account?: Account;
  /** Custom trigger node — defaults to a ghost "Nueva cuenta" button. */
  trigger?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className={GHOST_BUTTON_CLASS}>
            <Plus className="size-4" />
            {account ? "Editar" : "Nueva cuenta"}
          </Button>
        )}
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
