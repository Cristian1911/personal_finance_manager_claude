"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronsUpDown, Loader2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { getDestinatarios } from "@/actions/destinatarios";

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
  variant?: "popover" | "drawer";
}

export function DestinatarioZonePicker({
  value,
  onValueChange,
  placeholder = "Destinatario",
  triggerClassName,
  selectedName,
  variant: variantProp,
}: DestinatarioZonePickerProps) {
  const [open, setOpen] = useState(false);
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const variant = variantProp ?? (isDesktop ? "popover" : "drawer");

  const [destinatarios, setDestinatarios] = useState<DestinatarioOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Lazy-load on first open, cache in state
  useEffect(() => {
    if (!open || loaded) return;
    setLoading(true);
    getDestinatarios()
      .then((result) => {
        if (result.success) {
          setDestinatarios(
            result.data.map((d) => ({ id: d.id, name: d.name, is_active: d.is_active }))
          );
          setLoaded(true);
        }
      })
      .finally(() => setLoading(false));
  }, [open, loaded]);

  useEffect(() => {
    if (!open) setSearch("");
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

  // ── Trigger ──────────────────────────────────────────────────────────────

  const triggerButton = (
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
          className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-z-brass/40"
          autoFocus
        />
      </div>
      <div className="max-h-[50dvh] overflow-y-auto px-1 pb-2">
        {loading && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        )}
        {!loading && filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {search ? "Sin resultados" : "No hay destinatarios"}
          </p>
        )}
        {!loading &&
          filtered.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => handleSelect(d)}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left text-sm transition-colors hover:bg-white/5"
            >
              <span>{d.name}</span>
              {d.id === value && <Check className="size-4 text-z-brass" />}
            </button>
          ))}
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────────────────────

  if (variant === "popover") {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{triggerButton}</PopoverTrigger>
        <PopoverContent
          className="w-[280px] p-0"
          align="start"
          sideOffset={8}
        >
          {body}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <>
      {triggerButton}
      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <UserRound className="size-4 text-z-brass" />
              Destinatario
            </DrawerTitle>
          </DrawerHeader>
          {body}
        </DrawerContent>
      </Drawer>
    </>
  );
}
