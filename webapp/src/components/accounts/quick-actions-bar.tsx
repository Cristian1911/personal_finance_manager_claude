"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  HandCoins,
  ArrowLeftRight,
  Plus,
  RefreshCw,
  Ellipsis,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QuickPaymentDialog } from "./quick-payment-dialog";
import { ReconcileBalanceDialog } from "./reconcile-balance-dialog";
import { SpecializedAccountForm } from "./specialized-account-form";
import { TransferDialog } from "./transfer-dialog";
import { deleteAccount } from "@/actions/accounts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/domain";

interface QuickActionsBarProps {
  account: Account;
  allAccounts: Account[];
}

interface ActionDef {
  key: string;
  label: string;
  icon: React.ElementType;
  type: "payment" | "transfer" | "add" | "reconcile" | "more";
}

function getActionsForType(accountType: string): ActionDef[] {
  switch (accountType) {
    case "CREDIT_CARD":
      return [
        { key: "pay", label: "Pagar", icon: HandCoins, type: "payment" },
        { key: "add", label: "Agregar", icon: Plus, type: "add" },
        { key: "reconcile", label: "Ajustar", icon: RefreshCw, type: "reconcile" },
        { key: "more", label: "Más", icon: Ellipsis, type: "more" },
      ];
    case "SAVINGS":
    case "CHECKING":
    case "CASH":
      return [
        { key: "transfer", label: "Transferir", icon: ArrowLeftRight, type: "transfer" },
        { key: "add", label: "Agregar", icon: Plus, type: "add" },
        { key: "reconcile", label: "Ajustar", icon: RefreshCw, type: "reconcile" },
        { key: "more", label: "Más", icon: Ellipsis, type: "more" },
      ];
    case "LOAN":
      return [
        { key: "pay", label: "Pagar", icon: HandCoins, type: "payment" },
        { key: "reconcile", label: "Ajustar", icon: RefreshCw, type: "reconcile" },
        { key: "more", label: "Más", icon: Ellipsis, type: "more" },
      ];
    case "INVESTMENT":
      return [
        { key: "reconcile", label: "Ajustar", icon: RefreshCw, type: "reconcile" },
        { key: "more", label: "Más", icon: Ellipsis, type: "more" },
      ];
    default: // OTHER
      return [
        { key: "add", label: "Agregar", icon: Plus, type: "add" },
        { key: "reconcile", label: "Ajustar", icon: RefreshCw, type: "reconcile" },
        { key: "more", label: "Más", icon: Ellipsis, type: "more" },
      ];
  }
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  children,
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  children?: React.ReactNode;
}) {
  if (children) {
    // Wrap children (used for trigger-based dialogs)
    return (
      <div className="flex flex-col items-center gap-1">
        {children}
        <span className="text-[10px] text-z-muted">{label}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center gap-1"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white/80 transition-colors hover:bg-white/[0.1]">
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-[10px] text-z-muted">{label}</span>
    </button>
  );
}

function TriggerIcon({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white/80 transition-colors hover:bg-white/[0.1] cursor-pointer">
      <Icon className="h-4 w-4" />
    </span>
  );
}

export function QuickActionsBar({ account, allAccounts }: QuickActionsBarProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const accountType = account.account_type ?? "OTHER";
  const accountId = account.id ?? "";
  const accountName = account.name ?? "";
  const currentBalance = account.current_balance ?? 0;
  const currencyCode = account.currency_code ?? "COP";
  const actions = getActionsForType(accountType);

  async function handleDelete() {
    setDeleting(true);
    const result = await deleteAccount(accountId);
    setDeleting(false);
    if (result.success) {
      setDeleteOpen(false);
      router.push("/accounts");
      toast.success("Cuenta eliminada");
    } else {
      toast.error(result.error);
    }
  }

  function renderAction(action: ActionDef) {
    switch (action.type) {
      case "payment":
        return (
          <ActionButton key={action.key} icon={action.icon} label={action.label}>
            <QuickPaymentDialog
              accountId={accountId}
              accountName={accountName}
              accountType={accountType}
              currentBalance={currentBalance}
              currencyCode={currencyCode}
              accounts={allAccounts}
              trigger={<TriggerIcon icon={action.icon} />}
            />
          </ActionButton>
        );

      case "transfer":
        return (
          <ActionButton
            key={action.key}
            icon={action.icon}
            label={action.label}
            onClick={() => setTransferOpen(true)}
          />
        );

      case "add":
        return (
          <ActionButton
            key={action.key}
            icon={action.icon}
            label={action.label}
            onClick={() => router.push(`/transactions/new?account=${accountId}`)}
          />
        );

      case "reconcile":
        return (
          <ActionButton key={action.key} icon={action.icon} label={action.label}>
            <ReconcileBalanceDialog
              accountId={accountId}
              accountName={accountName}
              accountType={accountType}
              currentBalance={currentBalance}
              currencyBalances={account.currency_balances}
              currencyCode={currencyCode}
              trigger={<TriggerIcon icon={action.icon} />}
            />
          </ActionButton>
        );

      case "more":
        return (
          <div key={action.key} className="flex flex-col items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/[0.06] text-white/80 transition-colors hover:bg-white/[0.1] cursor-pointer">
                  <Ellipsis className="h-4 w-4" />
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => setEditOpen(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => setDeleteOpen(true)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <span className="text-[10px] text-z-muted">{action.label}</span>
          </div>
        );
    }
  }

  return (
    <>
      <div className="flex items-start justify-center gap-6">
        {actions.map(renderAction)}
      </div>

      {/* Transfer dialog */}
      <TransferDialog
        account={account}
        accounts={allAccounts}
        open={transferOpen}
        onOpenChange={setTransferOpen}
      />

      {/* Edit dialog (inline, controlled) */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar cuenta</DialogTitle>
          </DialogHeader>
          <SpecializedAccountForm
            account={account}
            onSuccess={() => setEditOpen(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog (inline, controlled) */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar cuenta</DialogTitle>
            <DialogDescription>
              ¿Estás seguro? Esta acción no se puede deshacer. Se eliminarán
              también todas las transacciones asociadas a esta cuenta.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
