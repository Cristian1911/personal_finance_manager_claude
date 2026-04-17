"use client";

import { useActionState, useEffect, useState } from "react";
import { KeyRound, Plus, Trash2, Pencil, X, Check } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createPdfPassword,
  updatePdfPassword,
  deletePdfPassword,
  type PdfPasswordEntry,
} from "@/actions/pdf-passwords";
import { BRASS_BUTTON_CLASS, GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { BANK_LOGOS } from "@/lib/icons/bank-logos";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Account } from "@/types/domain";

interface PdfPasswordsCardProps {
  initialEntries: PdfPasswordEntry[];
  accounts: Account[];
}

type CreateState = Awaited<ReturnType<typeof createPdfPassword>>;
type UpdateState = Awaited<ReturnType<typeof updatePdfPassword>>;
type DeleteState = Awaited<ReturnType<typeof deletePdfPassword>>;

const INITIAL_CREATE: CreateState = { success: false, error: "" };
const INITIAL_UPDATE: UpdateState = { success: false, error: "" };
const INITIAL_DELETE: DeleteState = { success: false, error: "" };

const BANK_OPTIONS = Object.keys(BANK_LOGOS);

const SCOPE_LABELS: Record<string, string> = {
  global: "Cualquier PDF",
  bank: "Por banco",
  account: "Por cuenta",
};

export function PdfPasswordsCard({
  initialEntries,
  accounts,
}: PdfPasswordsCardProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [createState, createAction, createPending] = useActionState(
    createPdfPassword,
    INITIAL_CREATE
  );

  useEffect(() => {
    if (!createState.success || !createState.data) return;
    const fresh = createState.data;
    setEntries((prev) => {
      if (prev.some((e) => e.id === fresh.id)) return prev;
      return [
        ...prev,
        {
          id: fresh.id,
          alias: fresh.alias,
          scope: fresh.scope as "global" | "bank" | "account",
          bank_key: fresh.bank_key,
          account_id: fresh.account_id,
          account_name:
            accounts.find((a) => a.id === fresh.account_id)?.name ?? null,
          has_password: true,
          updated_at: fresh.updated_at,
        },
      ];
    });
    setShowForm(false);
    toast.success("Contraseña guardada");
  }, [createState, accounts]);

  return (
    <Card className="border-white/6 bg-z-surface-2/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/6 bg-black/10">
            <KeyRound className="size-4 text-z-brass" />
          </div>
          <div className="flex-1">
            <CardTitle>Contraseñas de PDF</CardTitle>
            <p className="text-sm text-muted-foreground">
              Guarda las contraseñas de tus extractos para no reescribirlas.
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {entries.length === 0 && !showForm && (
          <p className="text-sm text-muted-foreground">
            Aún no guardaste ninguna contraseña.
          </p>
        )}

        {entries.length > 0 && (
          <ul className="space-y-2">
            {entries.map((entry) =>
              editingId === entry.id ? (
                <EditRow
                  key={entry.id}
                  entry={entry}
                  onCancel={() => setEditingId(null)}
                  onUpdated={(patch) => {
                    setEntries((prev) =>
                      prev.map((e) =>
                        e.id === entry.id ? { ...e, ...patch } : e
                      )
                    );
                    setEditingId(null);
                    toast.success("Contraseña actualizada");
                  }}
                />
              ) : (
                <DisplayRow
                  key={entry.id}
                  entry={entry}
                  accounts={accounts}
                  onEdit={() => setEditingId(entry.id)}
                  onDeleted={() => {
                    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
                    toast.success("Contraseña eliminada");
                  }}
                />
              )
            )}
          </ul>
        )}

        {showForm ? (
          <form action={createAction} className="space-y-3 rounded-lg border border-white/6 bg-black/10 p-3">
            <CreateFormFields accounts={accounts} />
            {!createState.success && createState.error && (
              <p className="text-xs text-destructive">{createState.error}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className={GHOST_BUTTON_CLASS}
                onClick={() => setShowForm(false)}
                disabled={createPending}
              >
                Cancelar
              </Button>
              <Button type="submit" className={BRASS_BUTTON_CLASS} disabled={createPending}>
                {createPending ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </form>
        ) : (
          <Button
            type="button"
            variant="ghost"
            className={cn(GHOST_BUTTON_CLASS, "w-full justify-start")}
            onClick={() => setShowForm(true)}
          >
            <Plus className="size-4" />
            Agregar contraseña
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function CreateFormFields({ accounts }: { accounts: Account[] }) {
  const [scope, setScope] = useState<"global" | "bank" | "account">("account");
  const [bankKey, setBankKey] = useState<string>(BANK_OPTIONS[0] ?? "");
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? "");

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="alias">Alias</Label>
          <Input
            id="alias"
            name="alias"
            required
            maxLength={60}
            placeholder="Ej: Cédula Cristian"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Contraseña</Label>
          <Input
            id="password"
            name="password"
            type="password"
            required
            maxLength={200}
            autoComplete="new-password"
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Aplica a</Label>
          <Select
            value={scope}
            onValueChange={(v) => setScope(v as typeof scope)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="account">Una cuenta</SelectItem>
              <SelectItem value="bank">Un banco</SelectItem>
              <SelectItem value="global">Cualquier PDF</SelectItem>
            </SelectContent>
          </Select>
          <input type="hidden" name="scope" value={scope} />
        </div>
        {scope === "account" && (
          <div className="space-y-1.5">
            <Label>Cuenta</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Elegir cuenta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="account_id" value={accountId} />
          </div>
        )}
        {scope === "bank" && (
          <div className="space-y-1.5">
            <Label>Banco</Label>
            <Select value={bankKey} onValueChange={setBankKey}>
              <SelectTrigger>
                <SelectValue placeholder="Elegir banco" />
              </SelectTrigger>
              <SelectContent>
                {BANK_OPTIONS.map((key) => (
                  <SelectItem key={key} value={key}>
                    {key}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <input type="hidden" name="bank_key" value={bankKey} />
          </div>
        )}
      </div>
    </div>
  );
}

function DisplayRow({
  entry,
  accounts,
  onEdit,
  onDeleted,
}: {
  entry: PdfPasswordEntry;
  accounts: Account[];
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [deleteState, deleteAction, pending] = useActionState(
    deletePdfPassword,
    INITIAL_DELETE
  );

  useEffect(() => {
    if (deleteState.success && deleteState.data.id === entry.id) {
      onDeleted();
    }
  }, [deleteState, entry.id, onDeleted]);

  const account = accounts.find((a) => a.id === entry.account_id);
  const scopeLabel =
    entry.scope === "account"
      ? (account?.name ?? entry.account_name ?? "Cuenta")
      : entry.scope === "bank"
      ? `Banco: ${entry.bank_key}`
      : "Cualquier PDF";

  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-white/6 bg-black/10 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{entry.alias}</p>
        <p className="truncate text-xs text-muted-foreground">
          {SCOPE_LABELS[entry.scope]} · {scopeLabel}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={cn(GHOST_BUTTON_CLASS, "size-8 px-0")}
          onClick={onEdit}
        >
          <Pencil className="size-3.5" />
        </Button>
        <form action={deleteAction}>
          <input type="hidden" name="id" value={entry.id} />
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            className={cn(GHOST_BUTTON_CLASS, "size-8 px-0 text-destructive")}
            disabled={pending}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </form>
      </div>
    </li>
  );
}

function EditRow({
  entry,
  onCancel,
  onUpdated,
}: {
  entry: PdfPasswordEntry;
  onCancel: () => void;
  onUpdated: (patch: Partial<PdfPasswordEntry>) => void;
}) {
  const [updateState, updateAction, pending] = useActionState(
    updatePdfPassword,
    INITIAL_UPDATE
  );

  useEffect(() => {
    if (updateState.success && updateState.data && updateState.data.id === entry.id) {
      onUpdated({
        alias: updateState.data.alias,
        updated_at: updateState.data.updated_at,
      });
    }
  }, [updateState, entry.id, onUpdated]);

  return (
    <li className="rounded-lg border border-white/6 bg-black/10 p-3">
      <form action={updateAction} className="space-y-3">
        <input type="hidden" name="id" value={entry.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`alias-${entry.id}`}>Alias</Label>
            <Input
              id={`alias-${entry.id}`}
              name="alias"
              defaultValue={entry.alias}
              maxLength={60}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`password-${entry.id}`}>Nueva contraseña</Label>
            <Input
              id={`password-${entry.id}`}
              name="password"
              type="password"
              placeholder="Dejar vacío para no cambiar"
              maxLength={200}
              autoComplete="new-password"
            />
          </div>
        </div>
        {!updateState.success && updateState.error && (
          <p className="text-xs text-destructive">{updateState.error}</p>
        )}
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            className={GHOST_BUTTON_CLASS}
            onClick={onCancel}
            disabled={pending}
          >
            <X className="size-3.5" />
            Cancelar
          </Button>
          <Button type="submit" className={BRASS_BUTTON_CLASS} disabled={pending}>
            <Check className="size-3.5" />
            Guardar
          </Button>
        </div>
      </form>
    </li>
  );
}
