"use client";

import { useCallback, useState, useTransition } from "react";
import Link from "next/link";
import {
  LogOut,
  Settings,
  Wallet,
  CalendarClock,
  ListChecks,
  Loader2,
  ArrowRight,
  Contact,
  FileUp,
  Folder,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/actions/auth";
import { getQuickViewData, type QuickViewData } from "@/actions/quick-view";
import { toggleReminder } from "@/actions/reminders";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useCloseOnNavigate } from "@/hooks/use-close-on-navigate";
import { useMediaQuery } from "@/hooks/use-media-query";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { cn } from "@/lib/utils";
import type { Profile, CurrencyCode } from "@/types/domain";

interface QuickViewMenuProps {
  profile: Profile;
}

export function QuickViewMenu({ profile }: QuickViewMenuProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<QuickViewData | null>(null);
  const [loading, startTransition] = useTransition();
  useCloseOnNavigate(useCallback(() => setOpen(false), []));

  const initials = (profile.full_name ?? profile.email ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const handleOpenFresh = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (nextOpen) {
        startTransition(async () => {
          const result = await getQuickViewData();
          setData(result);
        });
      }
    },
    [],
  );

  const trigger = (
    <button
      type="button"
      className="relative flex items-center gap-2 outline-none rounded-full"
      onClick={() => handleOpenFresh(!open)}
    >
      <Avatar className="h-8 w-8">
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
    </button>
  );

  const content = (
    <QuickViewContent
      data={data}
      loading={loading}
      profile={profile}
      onClose={() => setOpen(false)}
    />
  );

  if (isDesktop) {
    return (
      <Popover open={open} onOpenChange={handleOpenFresh}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent
          align="end"
          sideOffset={8}
          className="w-[340px] p-0"
        >
          {content}
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <>
      {trigger}
      <Drawer open={open} onOpenChange={handleOpenFresh}>
        <DrawerContent>
          <DrawerHeader className="sr-only">
            <DrawerTitle>Vista rápida</DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="px-0">
            {content}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

function QuickViewContent({
  data,
  loading,
  profile,
  onClose,
}: {
  data: QuickViewData | null;
  loading: boolean;
  profile: Profile;
  onClose: () => void;
}) {
  const firstName = profile.full_name?.split(" ")[0] ?? "Hola";

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b">
        <p className="text-sm text-muted-foreground">Hola, {firstName}</p>
      </div>

      {/* Financial snapshot */}
      <div className="px-4 py-3 space-y-3">
        {loading && !data ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <>
            {/* Disponible */}
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-0.5">
                <Wallet className="h-3 w-3" />
                Disponible para gastar
              </div>
              <p className="text-2xl font-semibold tabular-nums tracking-tight">
                {formatCurrency(data.availableToSpend, data.currency)}
              </p>
            </div>

            {/* Today's spending vs daily allowance */}
            <div className="grid grid-cols-2 gap-3">
              <QuickStat
                label="Gasto hoy"
                value={formatCurrency(data.spentToday, data.currency)}
                alert={data.dailyAllowance > 0 && data.spentToday > data.dailyAllowance}
              />
              <QuickStat
                label="Asignación diaria"
                value={formatCurrency(data.dailyAllowance, data.currency)}
              />
            </div>

            {/* Budget progress */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Presupuesto mensual</span>
                <span className={cn(
                  "font-medium tabular-nums",
                  data.budgetProgress > 100 ? "text-z-debt" : "text-muted-foreground",
                )}>
                  {Math.round(data.budgetProgress)}%
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    data.budgetProgress > 100 ? "bg-z-debt" :
                    data.budgetProgress > 80 ? "bg-z-alert" :
                    "bg-z-income",
                  )}
                  style={{ width: `${Math.min(data.budgetProgress, 100)}%` }}
                />
              </div>
            </div>

            {/* Upcoming obligations */}
            {data.upcomingObligations.length > 0 && (
              <div className="border-t pt-3">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-2">
                  <CalendarClock className="h-3 w-3" />
                  Próximos pagos
                </div>
                <div className="space-y-1.5">
                  {data.upcomingObligations.slice(0, 3).map((o) => (
                    <div
                      key={o.id}
                      className="flex items-center justify-between text-xs"
                    >
                      <span className="truncate flex-1 mr-2">{o.name}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {formatDate(o.due_date, "dd MMM")}
                      </span>
                      <span className="shrink-0 ml-2 font-mono tabular-nums">
                        {formatCurrency(o.amount, o.currency_code as CurrencyCode)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Pending reminders */}
            {data.pendingReminders.length > 0 && (
              <QuickReminders reminders={data.pendingReminders} onClose={onClose} />
            )}
          </>
        ) : null}
      </div>

      {/* Quick jumps */}
      <div className="border-t px-4 py-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          Ir a
        </p>
        <div className="grid grid-cols-4 gap-2">
          <QuickJump href="/accounts" icon={Wallet} label="Cuentas" onClose={onClose} />
          <QuickJump
            href="/plan?tab=presupuesto"
            icon={Folder}
            label="Categorías"
            onClose={onClose}
          />
          <QuickJump
            href="/plan?tab=recurrentes"
            icon={CalendarClock}
            label="Recurrentes"
            onClose={onClose}
          />
          <QuickJump href="/import" icon={FileUp} label="Importar" onClose={onClose} />
        </div>
      </div>

      {/* Footer: Destinatarios + Settings + Sign out */}
      <div className="border-t px-4 py-2 flex items-center gap-1">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={onClose}
        >
          <Link href="/destinatarios">
            <Contact className="h-3.5 w-3.5" />
            Destinatarios
          </Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5"
          onClick={onClose}
        >
          <Link href="/settings">
            <Settings className="h-3.5 w-3.5" />
            Ajustes
          </Link>
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-destructive"
          onClick={() => signOut()}
        >
          <LogOut className="h-3.5 w-3.5" />
          Salir
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuickJump
// ---------------------------------------------------------------------------

function QuickJump({
  href,
  icon: Icon,
  label,
  onClose,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  onClose: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClose}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-white/6 bg-white/[0.02] px-2 py-2.5 transition-colors hover:bg-white/5"
    >
      <Icon className="size-4 text-muted-foreground" />
      <span className="text-[11px] font-medium leading-none">{label}</span>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// QuickReminders
// ---------------------------------------------------------------------------

function QuickReminders({
  reminders,
  onClose,
}: {
  reminders: QuickViewData["pendingReminders"];
  onClose: () => void;
}) {
  const [items, setItems] = useState(reminders);
  const [, startTransition] = useTransition();

  const today = new Date().toISOString().split("T")[0];

  function handleToggle(id: string) {
    setItems((prev) => prev.filter((r) => r.id !== id));
    startTransition(async () => {
      await toggleReminder(id);
    });
  }

  return (
    <div className="border-t pt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <ListChecks className="h-3 w-3" />
          Pendientes
        </div>
        <Link
          href="/gestionar"
          onClick={onClose}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-0.5"
        >
          Ver todos
          <ArrowRight className="h-2.5 w-2.5" />
        </Link>
      </div>
      <div className="space-y-1">
        {items.map((r) => {
          const isOverdue = r.due_date && r.due_date < today;
          return (
            <div
              key={r.id}
              className="flex items-center gap-2 text-xs group"
            >
              <Checkbox
                className="h-3.5 w-3.5"
                checked={false}
                onCheckedChange={() => handleToggle(r.id)}
              />
              <span className="truncate flex-1">{r.title}</span>
              {r.due_date && (
                <span
                  className={cn(
                    "shrink-0 text-[11px]",
                    isOverdue ? "text-z-debt" : "text-muted-foreground"
                  )}
                >
                  {formatDate(r.due_date, "dd MMM")}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QuickStat
// ---------------------------------------------------------------------------

function QuickStat({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: string;
  alert?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/6 bg-white/[0.02] px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn(
        "text-sm font-semibold tabular-nums",
        alert && "text-z-debt",
      )}>
        {value}
      </p>
    </div>
  );
}
