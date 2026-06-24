"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftRight, Check, ChevronsUpDown, ExternalLink, Plus, Tag, Type, UserRound, X } from "lucide-react";
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
import { AddDestinatarioPatternDialog } from "@/components/destinatarios/add-destinatario-pattern-dialog";
import type { CategoryWithChildren, CurrencyCode, DestinatarioKind } from "@/types/domain";
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
  /** Restrict the list to these destinatario kinds (e.g. ["person"]). Omit = all. */
  kindFilter?: DestinatarioKind[];
  /**
   * Kind to assign when creating a new destinatario from this picker. Without
   * it, createDestinatario defaults to "merchant" — which a person-only
   * kindFilter would then immediately hide, making creation appear to fail.
   * Defaults to the sole kindFilter entry when exactly one is given.
   */
  createKind?: DestinatarioKind;
  /**
   * Optional: when provided, the manage-view shows a "Usar nombre como título"
   * action that renames the originating transaction to the destinatario's name.
   * Only pass this from transaction contexts (not generic form pickers).
   */
  onUseAsTitle?: () => void;
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
  kindFilter,
  createKind,
  onUseAsTitle,
}: DestinatarioZonePickerProps) {
  const router = useRouter();
  // When exactly one kind is being filtered, default new rows to that kind so
  // creation isn't immediately hidden by the same filter.
  const effectiveCreateKind =
    createKind ?? (kindFilter?.length === 1 ? kindFilter[0] : undefined);
  // When categories are provided, "Crear nuevo" opens the full seeded form
  // (token chips when seed text exists, otherwise a plain rich form). The bare
  // name+pattern mini-form remains only as the fallback for callers that don't
  // pass categories.
  const seeded = Boolean(categories);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showAddPattern, setShowAddPattern] = useState(false);
  // When a destinatario is already assigned the picker opens in "manage" mode;
  // tapping "Cambiar" flips to the search list. Reset when the picker closes.
  const [showListView, setShowListView] = useState(false);
  // Carries the typed search term into the create form's Nombre field, since
  // closing the picker clears `search`.
  const [dialogPrefillName, setDialogPrefillName] = useState<string | undefined>(undefined);
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
      setShowListView(false);
      return;
    }
    getRecentDestinatarios(3).then(setRecents);
  }, [open]);

  const active = useMemo(
    () =>
      destinatarios.filter(
        (d) => d.is_active && (!kindFilter || kindFilter.includes(d.kind))
      ),
    [destinatarios, kindFilter]
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

  // ── Manage mode (a destinatario is already assigned) ──────────────────────
  const canAddPattern = Boolean(rawDescription || merchantName);
  const inManageView = Boolean(value && displayName && !showListView);

  function handleViewDetails() {
    if (!value) return;
    setOpen(false);
    router.push(`/destinatarios/${value}`);
  }
  function handleRemove() {
    onValueChange(null, null);
    setOpen(false);
  }

  // Seeded: open the rich create form. Unseeded: legacy quick-create / mini-form.
  function openCreate(prefillName?: string) {
    if (seeded) {
      setDialogPrefillName(prefillName);
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
      if (effectiveCreateKind) fd.set("kind", effectiveCreateKind);
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
      type="button"
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

  // ── Manage body (shown when a destinatario is already assigned) ───────────
  const manageRowClass =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/5 focus-visible:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-z-brass/40";
  const manageBody = (
    <div className="flex flex-col p-2">
      <div className="mb-1 flex items-center gap-3 rounded-xl border border-z-brass/25 bg-z-brass/10 px-3 py-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-z-brass/15 text-z-brass">
          <UserRound className="size-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{displayName}</p>
          <p className="text-[11px] text-muted-foreground">Destinatario asignado</p>
        </div>
      </div>
      <button type="button" onClick={() => setShowListView(true)} className={manageRowClass}>
        <ArrowLeftRight className="size-4 text-muted-foreground" />
        Cambiar destinatario
      </button>
      <button type="button" onClick={handleViewDetails} className={manageRowClass}>
        <ExternalLink className="size-4 text-muted-foreground" />
        Ver detalles
      </button>
      {canAddPattern && (
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setShowAddPattern(true);
          }}
          className={manageRowClass}
        >
          <Tag className="size-4 text-muted-foreground" />
          Agregar patrón
        </button>
      )}
      {onUseAsTitle && (
        <button
          type="button"
          onClick={() => {
            onUseAsTitle();
            setOpen(false);
          }}
          className={manageRowClass}
        >
          <Type className="size-4 text-muted-foreground" />
          Usar nombre como título
        </button>
      )}
      <div className="my-1 h-px bg-white/6" />
      <button type="button" onClick={handleRemove} className={cn(manageRowClass, "text-z-expense")}>
        <X className="size-4" />
        Quitar destinatario
      </button>
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
        merchantName={merchantName || dialogPrefillName}
        amount={amount}
        currencyCode={currencyCode}
        onCreated={(d) => {
          onValueChange(d.id, d.name);
          setShowCreateDialog(false);
        }}
        onCancel={() => setShowCreateDialog(false)}
      />
    ) : null;

  const addPatternDialog =
    value && displayName && showAddPattern ? (
      <AddDestinatarioPatternDialog
        open={showAddPattern}
        onOpenChange={setShowAddPattern}
        destinatarioId={value}
        destinatarioName={displayName}
        rawDescription={rawDescription}
        merchantName={merchantName}
        amount={amount}
        currencyCode={currencyCode}
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
            {inManageView ? manageBody : body}
          </PopoverContent>
        </Popover>
        {createDialog}
        {addPatternDialog}
      </>
    );
  }

  if (variant === "dialog") {
    return (
      <>
        {!hideTrigger && triggerButton}
        <Dialog open={open} onOpenChange={setOpen}>
          {/* The "dialog" variant (not the mobile vaul Drawer) is used inside
              the create-deuda Sheet: a nested radix Dialog stacks correctly
              within the sheet's modal, while a sibling Drawer portal is left
              pointer-events-locked. The z-order is handled by the layer scale —
              same --z-layer-modal tier, later in the DOM, so it sits above. */}
          <DialogContent
            className={cn(
              "flex max-h-[70vh] w-full max-w-sm flex-col gap-0 overflow-hidden p-0",
            )}
          >
            <DialogHeader className="border-b px-4 py-3">
              <DialogTitle className="flex items-center gap-2">
                <UserRound className="size-4 text-z-brass" />
                Destinatario
              </DialogTitle>
            </DialogHeader>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {inManageView ? manageBody : body}
            </div>
          </DialogContent>
        </Dialog>
        {createDialog}
        {addPatternDialog}
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
            {inManageView ? manageBody : body}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
      {createDialog}
      {addPatternDialog}
    </>
  );
}
