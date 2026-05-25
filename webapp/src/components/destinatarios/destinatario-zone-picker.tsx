"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Check, ChevronsUpDown, Plus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { GHOST_BUTTON_CLASS, BRASS_GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useDestinatarios } from "@/components/providers/app-data-provider";
import { createDestinatario, getRecentDestinatarios, addDestinatarioRule } from "@/actions/destinatarios";
import { DestinatarioCreateDialog } from "@/components/destinatarios/destinatario-create-form";
import type { CategoryWithChildren, CurrencyCode } from "@/types/domain";
import { toast } from "sonner";

type DestinatarioOption = {
  id: string;
  name: string;
  is_active: boolean;
};

interface DestinatarioZonePickerProps {
  value: string | null;
  onValueChange: (id: string | null, name: string | null) => void;
  placeholder?: string;
  triggerClassName?: string;
  /** Currently selected name — avoids extra lookup when known */
  selectedName?: string | null;
  /** Render as a small icon button instead of a combobox */
  compact?: boolean;
  variant?: "popover" | "dialog" | "drawer";
  /** External open control — when defined, suppresses internal state. */
  controlledOpen?: boolean;
  onControlledOpenChange?: (open: boolean) => void;
  /** Hide the default trigger button — parent opens via controlledOpen. */
  hideTrigger?: boolean;
  /** When provided, "Crear nuevo" opens the seeded create form instead of the
   *  bare name/pattern mini-form. */
  categories?: CategoryWithChildren[];
  rawDescription?: string | null;
  merchantName?: string | null;
  amount?: number | null;
  currencyCode?: CurrencyCode | null;
}

export function DestinatarioZonePicker({
  value,
  onValueChange,
  placeholder = "Destinatario",
  triggerClassName,
  selectedName,
  compact = false,
  variant: variantProp,
  controlledOpen,
  onControlledOpenChange,
  hideTrigger = false,
  categories,
  rawDescription,
  merchantName,
  amount,
  currencyCode,
}: DestinatarioZonePickerProps) {
  const seeded = Boolean(categories && (rawDescription || merchantName));
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [internalOpen, setInternalOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (isControlled) {
      onControlledOpenChange?.(next);
    } else {
      setInternalOpen(next);
    }
  };
  const [creating, setCreating] = useState(false);
  const [, startCreateTransition] = useTransition();
  const createInputRef = useRef<HTMLInputElement>(null);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const variant = variantProp ?? (isDesktop ? "popover" : "drawer");

  const destinatarios = useDestinatarios();
  const [search, setSearch] = useState("");
  const [recents, setRecents] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setCreating(false);
      return;
    }
    getRecentDestinatarios(3).then(setRecents);
  }, [open]);

  const active = useMemo(
    () => destinatarios.filter((d) => d.is_active),
    [destinatarios]
  );

  const filtered = useMemo(() => {
    if (!search) return active;
    const q = search.toLowerCase();
    return active.filter((d) => d.name.toLowerCase().includes(q));
  }, [active, search]);

  const displayName =
    selectedName ?? destinatarios.find((d) => d.id === value)?.name ?? null;

  function handleSelect(dest: DestinatarioOption) {
    onValueChange(dest.id, dest.name);
    setOpen(false);
  }

  // Seeded: open the rich create form. Unseeded: legacy quick-create / mini-form.
  function openCreate(prefillName?: string) {
    if (seeded) {
      setOpen(false);
      setShowCreateDialog(true);
    } else if (prefillName) {
      handleCreate(prefillName);
    } else {
      setCreating(true);
    }
  }

  function handleCreate(name: string, pattern: string | null = null) {
    startCreateTransition(async () => {
      const fd = new FormData();
      fd.set("name", name);
      const result = await createDestinatario({ success: false, error: "" }, fd);
      if (result.success) {
        if (pattern?.trim()) {
          const ruleFd = new FormData();
          ruleFd.set("pattern", pattern.trim());
          ruleFd.set("match_type", "contains");
          await addDestinatarioRule(result.data.id, { success: false, error: "" }, ruleFd);
        }
        onValueChange(result.data.id, result.data.name);
        setOpen(false);
        setCreating(false);
        toast.success(`Destinatario "${name}" creado`);
      } else {
        toast.error(result.error || "Error al crear destinatario");
      }
    });
  }

  // ── Trigger ──────────────────────────────────────────────────────────────

  const triggerButton = compact ? (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={cn(
        "inline-flex items-center justify-center rounded-lg border border-white/6 bg-white/[0.03] p-1.5 text-muted-foreground transition-colors hover:bg-white/[0.06]",
        displayName && "bg-white/5 px-2.5 py-1 text-[10px] font-medium",
        triggerClassName
      )}
    >
      {displayName ? displayName : <UserRound className="size-3" />}
    </button>
  ) : (
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className={cn(
        "justify-between font-normal",
        !displayName && "text-muted-foreground",
        triggerClassName
      )}
      {...(variant !== "popover" ? { onClick: () => setOpen(true) } : {})}
    >
      {displayName ? (
        <span className="flex items-center gap-1.5 truncate">
          <UserRound className="size-3 shrink-0" />
          <span className="truncate">{displayName}</span>
        </span>
      ) : (
        <span className="truncate">{placeholder}</span>
      )}
      <ChevronsUpDown className="ml-1 h-3.5 w-3.5 shrink-0 opacity-50" />
    </Button>
  );

  // ── Body ─────────────────────────────────────────────────────────────────

  const body = (
    <div className="flex flex-col">
      <div className="p-3">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar destinatario..."
          className="w-full rounded-lg border border-white/6 bg-white/[0.03] px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-z-brass/40"
        />
      </div>
      {recents.length > 0 && !search && (
        <div className="flex flex-wrap gap-1.5 px-3 pb-2">
          {recents.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => handleSelect({ ...d, is_active: true })}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
                d.id === value
                  ? "border-z-brass/30 bg-z-brass/10 text-z-brass"
                  : "border-white/8 bg-white/[0.03] text-muted-foreground hover:bg-white/[0.06]"
              )}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}
      <div className="max-h-[50dvh] overflow-y-auto px-1 pb-2">
        {filtered.length === 0 && search ? (
          <div className="px-3 py-4">
            <button
              type="button"
              onClick={() => openCreate(search)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-z-brass transition-colors hover:bg-white/5"
            >
              <Plus className="size-3.5" />
              <span>Crear &laquo;{search}&raquo;</span>
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <UserRound className="size-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No hay destinatarios</p>
            <p className="text-xs text-muted-foreground/70">Crea uno con el botón de abajo</p>
          </div>
        ) : null}
        {filtered.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => handleSelect(d)}
            className={cn(
              "flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/5",
              d.id === value && "bg-z-brass/5"
            )}
          >
            <span className="flex items-center gap-2">
              <UserRound className="size-3.5 text-muted-foreground" />
              <span>{d.name}</span>
            </span>
            {d.id === value && <Check className="size-4 text-z-brass" />}
          </button>
        ))}
        {/* Inline create form */}
        {creating && !search ? (
          <form
            className="space-y-2.5 px-3 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              const name = fd.get("create_name") as string;
              if (name?.trim()) handleCreate(name.trim(), fd.get("create_pattern") as string | null);
            }}
          >
            <input
              ref={createInputRef}
              name="create_name"
              type="text"
              placeholder="Nombre del destinatario..."
              className="w-full rounded-lg border border-white/6 bg-white/[0.03] px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-z-brass/40"
              autoFocus
            />
            <input
              name="create_pattern"
              type="text"
              placeholder="Patrón de texto (opcional)..."
              className="w-full rounded-lg border border-white/6 bg-white/[0.03] px-2.5 py-1.5 text-xs outline-none placeholder:text-muted-foreground focus:border-z-brass/40"
            />
            <div className="flex gap-1.5">
              <button
                type="button"
                onClick={() => setCreating(false)}
                className={cn(GHOST_BUTTON_CLASS, "flex-1 rounded-lg px-2.5 py-1.5 text-xs")}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className={cn(BRASS_GHOST_BUTTON_CLASS, "flex-1 rounded-lg px-2.5 py-1.5 text-xs font-medium")}
              >
                Crear
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => openCreate(search || undefined)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm text-z-brass transition-colors hover:bg-white/5"
          >
            <Plus className="size-3.5" />
            <span>Crear nuevo</span>
          </button>
        )}
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────

  const createDialog =
    seeded && categories && showCreateDialog ? (
      <DestinatarioCreateDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        categories={categories}
        rawDescription={rawDescription}
        merchantName={merchantName}
        amount={amount}
        currencyCode={currencyCode}
        onCreated={(d) => {
          onValueChange(d.id, d.name);
          setShowCreateDialog(false);
        }}
        onCancel={() => setShowCreateDialog(false)}
      />
    ) : null;

  if (variant === "popover") {
    return (
      <>
        <Popover open={open} onOpenChange={setOpen}>
          {!hideTrigger && <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>}
          <PopoverContent
            className="w-[280px] p-0"
            align="start"
            sideOffset={8}
          >
            {body}
          </PopoverContent>
        </Popover>
        {createDialog}
      </>
    );
  }

  if (variant === "dialog") {
    return (
      <>
        {!hideTrigger && triggerButton}
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="flex max-h-[70vh] w-full max-w-sm flex-col gap-0 overflow-hidden p-0">
            <DialogHeader className="border-b px-4 py-3">
              <DialogTitle className="flex items-center gap-2">
                <UserRound className="size-4 text-z-brass" />
                Destinatario
              </DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {body}
            </div>
          </DialogContent>
        </Dialog>
        {createDialog}
      </>
    );
  }

  // variant === "drawer"
  return (
    <>
      {!hideTrigger && triggerButton}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <UserRound className="size-4 text-z-brass" />
              Destinatario
            </DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="px-2">
            {body}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      {createDialog}
    </>
  );
}
