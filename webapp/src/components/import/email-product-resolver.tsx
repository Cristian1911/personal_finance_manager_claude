"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { AlertTriangle, CreditCard, Landmark, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createAccountForEmailProduct,
  linkEmailProductToAccount,
  type EmailProductResolution,
} from "@/actions/email-ingest";
import {
  accountCarriesEmailProduct,
  accountFitsEmailProduct,
  describeEmailProduct,
  emailProductKind,
  suggestEmailProductAccountName,
  type EmailAccountMatch,
} from "@/lib/email-ingest/account-matching";
import { CURRENCIES } from "@/lib/constants/currencies";
import {
  BRASS_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  PANEL_INSET_CLASS,
  SEGMENTED_TAB_ACTIVE_CLASS,
  SEGMENTED_TAB_CLASS,
} from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import { normalizeAccountMaskSuffix } from "@/lib/utils/account-mask";
import type { ParsedEmailTransaction } from "@/lib/parsers/bancolombia-email";
import type { Account, CurrencyCode } from "@/types/domain";

/** The product an alert names — enough to open the prompt and to call the actions. */
export type EmailProduct = Pick<ParsedEmailTransaction, "card_type" | "card_last4">;

const REGISTER_VALUE = "__register-email-product__";

/* ─── Hook: resolution state shared by every queue surface ────────────────── */

interface UseEmailProductResolverOptions {
  accounts: Account[];
  /** Rows now suggested into `accountId` — the surface sets its overrides. */
  onResolved: (accountId: string, pendingIds: string[]) => void;
  /** Runs after a resolution lands — e.g. `router.refresh()`. */
  afterChange?: () => void;
}

/**
 * Owns the "producto no registrado" prompt for a queue surface: which
 * product is being resolved, and the accounts created/updated here until
 * the server refresh brings them back through the normal channel.
 */
export function useEmailProductResolver({
  accounts,
  onResolved,
  afterChange,
}: UseEmailProductResolverOptions) {
  const [product, setProduct] = useState<EmailProduct | null>(null);
  // Row the prompt was opened from: it always gets the answer, even if the
  // server-side re-suggestion of the queue came back short.
  const [originId, setOriginId] = useState<string | null>(null);
  const [localAccounts, setLocalAccounts] = useState<Account[]>([]);

  // Fresh server data wins; accounts created here are appended until the
  // refresh includes them, so the row selector can show them right away.
  const mergedAccounts = useMemo(() => {
    const known = new Set(accounts.map((a) => a.id));
    const extras = localAccounts.filter((a) => !known.has(a.id));
    return extras.length > 0 ? [...accounts, ...extras] : accounts;
  }, [accounts, localAccounts]);

  const openFor = useCallback((next: EmailProduct, pendingId?: string) => {
    setProduct({ card_type: next.card_type, card_last4: next.card_last4 });
    setOriginId(pendingId ?? null);
  }, []);
  const close = useCallback(() => setProduct(null), []);

  const handleResolved = useCallback(
    (resolution: EmailProductResolution) => {
      setLocalAccounts((prev) => [
        ...prev.filter((a) => a.id !== resolution.account.id),
        resolution.account,
      ]);
      const pendingIds = originId
        ? [...new Set([originId, ...resolution.pendingIds])]
        : resolution.pendingIds;
      onResolved(resolution.account.id, pendingIds);
      setProduct(null);
      afterChange?.();
    },
    [onResolved, afterChange, originId],
  );

  return { product, openFor, close, accounts: mergedAccounts, handleResolved };
}

/* ─── Row selector: account picker that names an unregistered product ─────── */

interface EmailAccountSelectProps {
  accounts: Pick<Account, "id" | "name" | "currency_code">[];
  value: string | undefined;
  match: EmailAccountMatch | null;
  product: EmailProduct | null;
  onChange: (accountId: string) => void;
  /** Opens the "producto no registrado" prompt for `product`. */
  onRegister: () => void;
  disabled?: boolean;
  /** Trigger classes for the resolved state; the alert tint is applied here. */
  triggerClassName?: string;
  itemClassName?: string;
}

/**
 * Per-row account picker shared by the queue surfaces. When the alert's
 * mask is on no account, the trigger says so ("Tarjeta de crédito *7706 no
 * registrada") and the list opens with a "Registrar…" entry that starts the
 * prompt — the selector never silently offers the default account.
 */
export function EmailAccountSelect({
  accounts,
  value,
  match,
  product,
  onChange,
  onRegister,
  disabled,
  triggerClassName,
  itemClassName,
}: EmailAccountSelectProps) {
  const unrecognized = !value && match?.status === "unrecognized" && !!product;
  const productLabel = product ? describeEmailProduct(product) : null;
  const placeholder = unrecognized ? `${productLabel} no registrada` : "Sin cuenta";

  return (
    <Select
      // "" keeps Radix controlled while showing the placeholder; `undefined`
      // would flip it to uncontrolled and the "Registrar…" entry would stick
      // in the trigger as if it were the chosen account.
      value={value ?? ""}
      onValueChange={(v) => (v === REGISTER_VALUE ? onRegister() : onChange(v))}
      disabled={disabled}
    >
      <SelectTrigger
        aria-label="Cuenta"
        className={cn(
          triggerClassName,
          !value && "border-z-alert/30 bg-z-alert/5 text-z-alert",
        )}
      >
        {!value && <AlertTriangle className="size-3 shrink-0" />}
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {unrecognized && (
          <>
            <SelectItem
              value={REGISTER_VALUE}
              className={cn(itemClassName, "font-medium text-z-brass focus:text-z-brass")}
            >
              <Plus className="size-3.5 text-z-brass" />
              Registrar {productLabel}…
            </SelectItem>
            <SelectSeparator />
          </>
        )}
        {accounts.map((acc) => (
          <SelectItem key={acc.id} value={acc.id} className={itemClassName}>
            {acc.name} ({acc.currency_code})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ─── Prompt: what to do with a product no account knows ──────────────────── */

type Mode = "link" | "create";
type CreatableType = "CREDIT_CARD" | "SAVINGS" | "CHECKING";

interface EmailProductDialogProps {
  /** Open while non-null. */
  product: EmailProduct | null;
  accounts: Account[];
  onClose: () => void;
  onResolved: (resolution: EmailProductResolution) => void;
}

/**
 * "Producto no registrado" — asks what the alert's card/account is. A credit
 * card is created with just a name and currency (limit, cutoff, payment day
 * and rate arrive with its next PDF statement); a debit card is attached to
 * the savings account it draws from; an account number is attached or
 * created. Either way every queued alert from that product gets the answer.
 */
export function EmailProductDialog({
  product,
  accounts,
  onClose,
  onResolved,
}: EmailProductDialogProps) {
  return (
    <Dialog open={!!product} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {product && (
          <EmailProductDialogBody
            key={`${product.card_type}:${product.card_last4}`}
            product={product}
            accounts={accounts}
            onClose={onClose}
            onResolved={onResolved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EmailProductDialogBody({
  product,
  accounts,
  onClose,
  onResolved,
}: EmailProductDialogProps & { product: EmailProduct }) {
  const kind = emailProductKind(product.card_type);
  const last4 = normalizeAccountMaskSuffix(product.card_last4);
  const productLabel = describeEmailProduct(product);
  const isCredit = kind === "credit_card";
  const isDebit = kind === "debit_card";

  const candidates = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.is_active &&
          accountFitsEmailProduct(a.account_type, product.card_type) &&
          !accountCarriesEmailProduct(a, product.card_type, last4),
      ),
    [accounts, product.card_type, last4],
  );

  // A new credit card is almost always created; a debit card or account
  // number usually belongs to something the user already tracks. With
  // nothing to attach to, creating is the only answer.
  const [chosenMode, setMode] = useState<Mode>(isCredit ? "create" : "link");
  const mode: Mode = candidates.length === 0 ? "create" : chosenMode;
  const [selectedId, setSelectedId] = useState<string | null>(
    candidates.length === 1 ? candidates[0].id : null,
  );
  const [name, setName] = useState(() => suggestEmailProductAccountName(product));
  const [accountType, setAccountType] = useState<CreatableType>(
    isCredit ? "CREDIT_CARD" : "SAVINGS",
  );
  const [currencyCode, setCurrencyCode] = useState<CurrencyCode>("COP");
  const [isPending, startTransition] = useTransition();

  const selected = candidates.find((a) => a.id === selectedId) ?? null;

  function submit() {
    startTransition(async () => {
      const ref = { cardType: product.card_type, last4: product.card_last4 };
      const result =
        mode === "link"
          ? selectedId
            ? await linkEmailProductToAccount(ref, selectedId)
            : null
          : await createAccountForEmailProduct(ref, { name, accountType, currencyCode });
      if (!result) return;
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      const count = result.data.pendingIds.length;
      toast.success(
        mode === "link"
          ? `${productLabel} asociada a ${result.data.account.name}`
          : `${result.data.account.name} creada`,
        {
          description:
            count > 1 ? `${count} movimientos en cola ahora apuntan a esa cuenta.` : undefined,
        },
      );
      onResolved(result.data);
    });
  }

  const canSubmit = mode === "link" ? !!selectedId : name.trim().length > 0;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Producto no registrado</DialogTitle>
        <DialogDescription>
          La alerta viene de <span className="font-medium text-foreground">{productLabel}</span>{" "}
          y ninguna de tus cuentas la tiene registrada. ¿Qué es?
        </DialogDescription>
      </DialogHeader>

      {candidates.length > 0 && (
        <div
          role="tablist"
          aria-label="Qué hacer con el producto"
          className="flex gap-1 rounded-full border border-white/6 bg-black/10 p-1"
        >
          {(isCredit ? (["create", "link"] as const) : (["link", "create"] as const)).map(
            (m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => setMode(m)}
                className={mode === m ? SEGMENTED_TAB_ACTIVE_CLASS : SEGMENTED_TAB_CLASS}
              >
                {m === "create"
                  ? isCredit
                    ? "Es una tarjeta nueva"
                    : "Crear cuenta nueva"
                  : isCredit
                    ? "Ya la tengo registrada"
                    : isDebit
                      ? "Es de una cuenta que tengo"
                      : "Es una cuenta que tengo"}
              </button>
            ),
          )}
        </div>
      )}

      {mode === "link" ? (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {isDebit
              ? "Elige la cuenta de la que sale el dinero con esta tarjeta débito."
              : isCredit
                ? "Elige la tarjeta. Pasará a reconocerse con el número *" + last4 + "."
                : "Elige la cuenta. Si no tiene número registrado, aprenderá *" + last4 + "."}
          </p>
          <ul className="max-h-60 space-y-1 overflow-y-auto" role="listbox" aria-label="Cuentas">
            {candidates.map((acc) => {
              const active = acc.id === selectedId;
              const known = isDebit
                ? normalizeAccountMaskSuffix(acc.debit_card_mask)
                : normalizeAccountMaskSuffix(acc.mask);
              const hint = isDebit
                ? known
                  ? `Débito *${known} registrada — se reemplaza`
                  : "Sin tarjeta débito registrada"
                : known
                  ? `****${known}`
                  : "Sin número registrado";
              return (
                <li key={acc.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => setSelectedId(acc.id)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      active
                        ? "border-z-brass/40 bg-z-brass/12 text-z-brass"
                        : "border-white/6 bg-white/[0.03] text-foreground hover:bg-white/6",
                    )}
                  >
                    {acc.account_type === "CREDIT_CARD" ? (
                      <CreditCard className="size-4 shrink-0 text-z-brass" />
                    ) : (
                      <Landmark className="size-4 shrink-0 text-z-brass" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{acc.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {hint} · {acc.currency_code}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {!isDebit && !isCredit && selected && normalizeAccountMaskSuffix(selected.mask) && (
            <p className="text-xs text-z-alert">
              Esta cuenta ya tiene otro número; solo se usará para las alertas que están en cola.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="email-product-name">Nombre</Label>
            <Input
              id="email-product-name"
              value={name}
              maxLength={100}
              onChange={(e) => setName(e.target.value)}
              className="h-10 rounded-xl border-white/6 bg-white/[0.03] shadow-none focus-visible:border-z-brass/40 focus-visible:ring-0"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            {!isCredit && (
              <div className="space-y-1.5">
                <Label htmlFor="email-product-type">Tipo</Label>
                <Select
                  value={accountType}
                  onValueChange={(v) => setAccountType(v as CreatableType)}
                >
                  <SelectTrigger id="email-product-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SAVINGS">Ahorros</SelectItem>
                    <SelectItem value="CHECKING">Corriente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className={cn("space-y-1.5", isCredit && "col-span-2")}>
              <Label htmlFor="email-product-currency">Moneda</Label>
              <Select
                value={currencyCode}
                onValueChange={(v) => setCurrencyCode(v as CurrencyCode)}
              >
                <SelectTrigger id="email-product-currency" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} · {c.name_es}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className={cn(PANEL_INSET_CLASS, "px-3 py-2 text-xs leading-relaxed text-muted-foreground")}>
            {isCredit
              ? "Cupo, fecha de corte, día de pago y tasa quedan pendientes: se completan solos al importar el próximo extracto PDF de esta tarjeta."
              : isDebit
                ? `Se crea con la tarjeta débito *${last4} asociada. El saldo se ajusta al importar el próximo extracto PDF.`
                : `Se crea con el número *${last4}. El saldo se ajusta al importar el próximo extracto PDF.`}
          </p>
        </div>
      )}

      <DialogFooter className="gap-2 sm:gap-0">
        <Button
          variant="outline"
          className={GHOST_BUTTON_CLASS}
          onClick={onClose}
          disabled={isPending}
        >
          Cancelar
        </Button>
        <Button
          className={BRASS_BUTTON_CLASS}
          onClick={submit}
          disabled={isPending || !canSubmit}
        >
          {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
          {mode === "link"
            ? "Asociar"
            : isCredit
              ? "Crear tarjeta"
              : "Crear cuenta"}
        </Button>
      </DialogFooter>
    </>
  );
}
