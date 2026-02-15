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
import type { Account } from "@/types/domain";

export function AccountFormDialog({ account }: { account?: Account }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {account ? "Editar" : "Nueva cuenta"}
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
