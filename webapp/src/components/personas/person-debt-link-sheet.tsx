"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Link2, MapPin, UserPlus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { BRASS_BUTTON_CLASS, SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";
import { formatCurrency } from "@/lib/utils/currency";
import { formatDate } from "@/lib/utils/date";
import { PersonAvatar } from "./person-avatar";
import {
  buildLinkOptions,
  describeDebtItem,
  type LinkDebtOption,
  type LinkScopeOption,
  type LinkTx,
} from "@/lib/personal-debts/link-options";
import type { PersonDebtSummary } from "@/lib/personal-debts/hierarchy";
import type { CurrencyCode } from "@/types/domain";

export type PersonDebtLinkSelection =
  | { kind: "debt"; id: string }
  | { kind: "scope"; debtIds: string[]; label: string };

interface PersonDebtLinkSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subtitle: string;
  tx: LinkTx;
  /** null while loading. */
  people: PersonDebtSummary[] | null;
  isPending: boolean;
  onConfirm: (selection: PersonDebtLinkSelection) => void;
  onCreateNew: () => void;
}

function roleLabel(o: LinkDebtOption): string {
  if (o.role === "repayment") return "abono";
  return o.item.origin_transaction_id ? "suma a la deuda" : "será el origen";
}

/**
 * "Vincular a persona": pick the person first, then abonar to everything
 * pending with them, to one viaje, or to one debt in particular. Mirrors the
 * persona → viaje → deudas hierarchy of Deudas personales.
 */
export function PersonDebtLinkSheet({
  open,
  onOpenChange,
  subtitle,
  tx,
  people,
  isPending,
  onConfirm,
  onCreateNew,
}: PersonDebtLinkSheetProps) {
  const [personId, setPersonId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const options = useMemo(() => (people ? buildLinkOptions(people, tx) : null), [people, tx]);
  const person = options?.find((p) => p.destinatario_id === personId) ?? null;
  const code = tx.currency_code as CurrencyCode;

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setPersonId(null);
      setSelected(null);
      setSearch("");
    }
    onOpenChange(next);
  };

  const filtered = (options ?? []).filter(
    (p) => !search || p.name.toLowerCase().includes(search.toLowerCase()),
  );

  function selection(): PersonDebtLinkSelection | null {
    if (!person || !selected) return null;
    const scope = person.scopes.find((s) => s.key === selected);
    if (scope) {
      const label = scope.kind === "persona" ? `todo con ${person.name}` : scope.label;
      return { kind: "scope", debtIds: scope.debtIds, label };
    }
    return { kind: "debt", id: selected };
  }
  const current = selection();

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent>
        <DrawerHeader className="text-left">
          <DrawerTitle>{person ? person.name : "Vincular a persona"}</DrawerTitle>
          <DrawerDescription>{subtitle}</DrawerDescription>
        </DrawerHeader>

        {!person && (
          <div className="shrink-0 px-4 pb-2">
            <Input
              placeholder="Buscar persona..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
            />
          </div>
        )}

        <DrawerBody safeArea={false}>
          {options === null && (
            <p className="py-8 text-center text-sm text-muted-foreground">Cargando personas…</p>
          )}

          {options && !person && (
            <>
              {filtered.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {search
                    ? `Nada coincide con «${search}»`
                    : "No tienes deudas personales activas en esta moneda. Crea una abajo."}
                </p>
              )}
              <div className="space-y-1">
                {filtered.map((p) => {
                  const count = p.sections.reduce((n, s) => n + s.debts.length, 0);
                  return (
                    <button
                      key={p.destinatario_id}
                      type="button"
                      onClick={() => {
                        setPersonId(p.destinatario_id);
                        setSelected(p.scopes.find((sc) => !sc.exceeds)?.key ?? null);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-z-brass/50"
                    >
                      <PersonAvatar name={p.name} className="size-8" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {count} {count === 1 ? "deuda" : "deudas"}
                          {p.pending > 0 &&
                            ` · ${tx.direction === "INFLOW" ? "te debe" : "le debes"} ${formatCurrency(p.pending, code)}`}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={onCreateNew}
                className="mt-3 flex w-full items-center gap-3 rounded-lg border border-dashed border-z-brass/30 bg-z-brass/5 px-3 py-3 text-left transition-colors hover:bg-z-brass/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-z-brass/60"
              >
                <span className="flex size-9 items-center justify-center rounded-full border border-z-brass/30 bg-z-brass/10">
                  <UserPlus className="size-4 text-z-brass" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-z-brass">
                    Crear deuda personal nueva
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    Registra la deuda y vincula esta transacción
                  </span>
                </span>
              </button>
            </>
          )}

          {person && (
            <>
              <button
                type="button"
                onClick={() => {
                  setPersonId(null);
                  setSelected(null);
                }}
                className="mb-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-z-brass"
              >
                <ChevronLeft className="size-3.5" aria-hidden />
                Personas
              </button>

              {person.scopes.length > 0 && (
                <>
                  <p className={cn(SECTION_EYEBROW_CLASS, "mb-1")}>Abono repartido</p>
                  <div className="space-y-1" role="radiogroup" aria-label="Abono repartido">
                    {person.scopes.map((s) => (
                      <ScopeRow
                        key={s.key}
                        scope={s}
                        personName={person.name}
                        code={code}
                        selected={selected === s.key}
                        onSelect={() => setSelected(s.key)}
                      />
                    ))}
                  </div>
                </>
              )}

              <p className={cn(SECTION_EYEBROW_CLASS, "mb-1", person.scopes.length > 0 && "mt-4")}>
                Una deuda en particular
              </p>
              <div className="space-y-3" role="radiogroup" aria-label="Una deuda en particular">
                {person.sections.map((sec) => (
                  <div key={sec.key}>
                    {(person.sections.length > 1 || sec.emoji) && (
                      <p className="mb-1 flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
                        {sec.emoji ?? (sec.key !== "sueltas" ? <MapPin className="size-3" aria-hidden /> : null)}
                        {sec.title}
                      </p>
                    )}
                    <div className="space-y-0.5">
                      {sec.debts.map((d) => (
                        <OptionRow
                          key={d.id}
                          selected={selected === d.id}
                          onSelect={() => setSelected(d.id)}
                          title={describeDebtItem(d.item, sec.emoji || sec.key === "sueltas" ? null : sec.title)}
                          meta={`${formatDate(d.item.origin?.transaction_date ?? d.item.opened_on, "dd MMM")} · ${roleLabel(d)}`}
                          amount={formatCurrency(Number(d.item.outstanding_amount), code)}
                          badge={d.shared ? "Compartido" : undefined}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </DrawerBody>

        {person && (
          <DrawerFooter>
            <Button
              onClick={() => current && onConfirm(current)}
              disabled={!current || isPending}
              className={cn(BRASS_BUTTON_CLASS, "w-full")}
            >
              <Link2 className="mr-2 size-4" />
              {isPending ? "Vinculando..." : current?.kind === "scope" ? "Vincular y repartir" : "Vincular"}
            </Button>
          </DrawerFooter>
        )}
      </DrawerContent>
    </Drawer>
  );
}

function ScopeRow({
  scope,
  personName,
  code,
  selected,
  onSelect,
}: {
  scope: LinkScopeOption;
  personName: string;
  code: CurrencyCode;
  selected: boolean;
  onSelect: () => void;
}) {
  const title = scope.kind === "persona" ? `A todo lo pendiente con ${personName}` : `Al viaje ${scope.label}`;
  const meta = scope.exceeds
    ? "El movimiento supera lo pendiente — elige una deuda"
    : `Se reparte entre ${scope.debtIds.length} deudas, la más antigua primero`;
  return (
    <OptionRow
      selected={selected}
      onSelect={onSelect}
      disabled={scope.exceeds}
      icon={
        scope.kind === "persona" ? (
          <Users className="size-4 text-z-brass" aria-hidden />
        ) : (
          (scope.emoji ?? <MapPin className="size-4 text-z-brass" aria-hidden />)
        )
      }
      title={title}
      meta={meta}
      amount={formatCurrency(scope.pending, code)}
    />
  );
}

function OptionRow({
  selected,
  onSelect,
  disabled,
  icon,
  title,
  meta,
  amount,
  badge,
}: {
  selected: boolean;
  onSelect: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  title: string;
  meta: string;
  amount: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-z-brass/50 disabled:opacity-50",
        selected ? "bg-z-brass/10 ring-1 ring-z-brass/30" : "hover:bg-white/[0.03]",
      )}
    >
      {icon && (
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-sm">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium">{title}</span>
          {badge && (
            <span className="shrink-0 rounded-full border border-z-brass/30 bg-z-brass/10 px-1.5 py-0.5 text-[10px] font-semibold text-z-brass">
              {badge}
            </span>
          )}
        </span>
        <span className="block text-xs text-muted-foreground">{meta}</span>
      </span>
      <span className="shrink-0 text-sm font-semibold tabular-nums">{amount}</span>
    </button>
  );
}
