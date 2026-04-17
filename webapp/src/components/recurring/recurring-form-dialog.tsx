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
import type { ActionResult } from "@/types/actions";
import type { Account, CategoryWithChildren, RecurringTemplate } from "@/types/domain";

type RecurringFormAction = (
  prevState: ActionResult<RecurringTemplate>,
  formData: FormData,
) => Promise<ActionResult<RecurringTemplate>>;

export function RecurringFormDialog({
  template,
  initialValues,
  actionOverride,
  accounts,
  categories,
  trigger,
  controlledOpen,
  onClose,
  onSuccess,
}: {
  template?: RecurringTemplate;
  initialValues?: Partial<RecurringTemplate>;
  actionOverride?: RecurringFormAction;
  accounts: Account[];
  categories: CategoryWithChildren[];
  trigger?: React.ReactNode;
  /** When true, dialog opens immediately without a trigger */
  controlledOpen?: boolean;
  onClose?: () => void;
  /** Fires after a successful save, before the dialog closes. Gives callers
   * a place to toast / navigate without wiring a separate observer. */
  onSuccess?: (template: RecurringTemplate | undefined) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    if (!v && onClose) onClose();
    setInternalOpen(v);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nueva recurrente
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? "Editar recurrente" : "Nueva transacción recurrente"}
          </DialogTitle>
        </DialogHeader>
        <RecurringForm
          template={template}
          initialValues={initialValues}
          actionOverride={actionOverride}
          accounts={accounts}
          categories={categories}
          onSuccess={(saved) => {
            onSuccess?.(saved);
            setOpen(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
