"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { Check, Loader2, UserRound, X } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  assignDestinatario,
  removeDestinatarioFromTransaction,
} from "@/actions/categorize";
import { getDestinatarios } from "@/actions/destinatarios";
import { toast } from "sonner";

type DestinatarioOption = {
  id: string;
  name: string;
  is_active: boolean;
};

interface DestinatarioDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transactionId: string;
  currentDestinatarioId: string | null;
  currentDestinatarioName: string | null;
  onAssigned?: (id: string, name: string) => void;
  onRemoved?: () => void;
}

export function DestinatarioDrawer({
  open,
  onOpenChange,
  transactionId,
  currentDestinatarioId,
  currentDestinatarioName,
  onAssigned,
  onRemoved,
}: DestinatarioDrawerProps) {
  const [search, setSearch] = useState("");
  const [destinatarios, setDestinatarios] = useState<DestinatarioOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    setLoading(true);
    getDestinatarios()
      .then((result) => {
        if (result.success) {
          setDestinatarios(
            result.data.map((d) => ({
              id: d.id,
              name: d.name,
              is_active: d.is_active,
            }))
          );
        }
      })
      .finally(() => setLoading(false));
  }, [open]);

  const activeDestinatarios = useMemo(
    () => destinatarios.filter((d) => d.is_active),
    [destinatarios]
  );

  const filtered = useMemo(() => {
    if (!search) return activeDestinatarios;
    const q = search.toLowerCase();
    return activeDestinatarios.filter((d) =>
      d.name.toLowerCase().includes(q)
    );
  }, [activeDestinatarios, search]);

  function handleSelect(dest: DestinatarioOption) {
    startTransition(async () => {
      const result = await assignDestinatario(transactionId, dest.id);
      if (result.success) {
        onAssigned?.(dest.id, dest.name);
        toast.success(`Asignado: ${dest.name}`);
      } else {
        toast.error("Error al asignar destinatario");
      }
      onOpenChange(false);
    });
  }

  function handleRemove() {
    startTransition(async () => {
      const result = await removeDestinatarioFromTransaction(transactionId);
      if (result.success) {
        onRemoved?.();
        toast.success("Destinatario removido");
      } else {
        toast.error("Error al remover destinatario");
      }
      onOpenChange(false);
    });
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle className="flex items-center gap-2">
            <UserRound className="size-4 text-z-brass" />
            Destinatario
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-4 pb-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar destinatario..."
            className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-z-brass/40"
            autoFocus
          />
        </div>

        {/* Current assignment */}
        {currentDestinatarioId && currentDestinatarioName && (
          <div className="mx-4 mb-2 flex items-center justify-between rounded-lg bg-z-brass/10 px-3 py-2">
            <span className="text-sm font-medium text-z-brass">
              {currentDestinatarioName}
            </span>
            <button
              type="button"
              onClick={handleRemove}
              disabled={isPending}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
            >
              <X className="size-3" />
              Quitar
            </button>
          </div>
        )}

        {/* List */}
        <div className="max-h-[50dvh] overflow-y-auto px-4 pb-4">
          {(loading || isPending) && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && !isPending && filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {search ? "Sin resultados" : "No hay destinatarios"}
            </p>
          )}
          {!loading &&
            !isPending &&
            filtered.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => handleSelect(d)}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/5"
              >
                <span>{d.name}</span>
                {d.id === currentDestinatarioId && (
                  <Check className="size-4 text-z-brass" />
                )}
              </button>
            ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
