"use client";

import { useState } from "react";
import { useActionState } from "react";
import { createAccount, updateAccount } from "@/actions/accounts";
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
import { CURRENCIES } from "@/lib/constants/currencies";
import type { ActionResult } from "@/types/actions";
import type { Account } from "@/types/domain";
import type { AccountFormDefaults } from "@/types/account-form";
import { Building2, CreditCard, PiggyBank, TrendingUp, Wallet, Landmark, Banknote } from "lucide-react";

const ACCOUNT_TYPES = [
  { value: "CHECKING", label: "Cuenta Corriente", icon: Building2, description: "Cuenta de cheques para uso diario" },
  { value: "SAVINGS", label: "Cuenta de Ahorros", icon: PiggyBank, description: "Ahorros con intereses" },
  { value: "CREDIT_CARD", label: "Tarjeta de Crédito", icon: CreditCard, description: "Tarjeta de crédito con límite" },
  { value: "CASH", label: "Efectivo", icon: Banknote, description: "Dinero en efectivo" },
  { value: "INVESTMENT", label: "Inversión", icon: TrendingUp, description: "CDT, fondos, acciones" },
  { value: "LOAN", label: "Préstamo", icon: Landmark, description: "Deuda o préstamo por pagar" },
  { value: "OTHER", label: "Otro", icon: Wallet, description: "Cuenta personalizada" },
];

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
];

interface Props {
  account?: Account;
  defaultValues?: AccountFormDefaults;
  onSuccess?: (account: Account) => void;
}

function getCurrentYear() {
  return new Date().getFullYear();
}

function generateYears(start: number, count: number) {
  return Array.from({ length: count }, (_, i) => start + i);
}

// Credit Card Fields Component
function CreditCardFields({ account, defaults }: { account?: Account; defaults: AccountFormDefaults }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="credit_limit">Límite de crédito *</Label>
          <Input
            id="credit_limit"
            name="credit_limit"
            type="number"
            step="0.01"
            defaultValue={account?.credit_limit ?? defaults.credit_limit ?? ""}
            placeholder="Ej: 5000000"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="interest_rate">Tasa de interés anual (%)</Label>
          <Input
            id="interest_rate"
            name="interest_rate"
            type="number"
            step="any"
            min="0"
            max="100"
            defaultValue={account?.interest_rate ?? defaults.interest_rate ?? ""}
            placeholder="Ej: 25.9"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="cutoff_day">Día de corte</Label>
          <Input
            id="cutoff_day"
            name="cutoff_day"
            type="number"
            min="1"
            max="31"
            defaultValue={account?.cutoff_day ?? defaults.cutoff_day ?? ""}
            placeholder="Ej: 15"
          />
          <p className="text-xs text-muted-foreground">
            Día en que cierra el ciclo de facturación
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="payment_day">Día de pago</Label>
          <Input
            id="payment_day"
            name="payment_day"
            type="number"
            min="1"
            max="31"
            defaultValue={account?.payment_day ?? defaults.payment_day ?? ""}
            placeholder="Ej: 25"
          />
          <p className="text-xs text-muted-foreground">
            Día límite para pagar sin intereses
          </p>
        </div>
      </div>
    </>
  );
}

// Loan Fields Component
function LoanFields({ account, defaults }: { account?: Account; defaults: AccountFormDefaults }) {
  const currentYear = getCurrentYear();

  const startDate = account?.loan_start_date ? new Date(account.loan_start_date) : null;
  const endDate = account?.loan_end_date ? new Date(account.loan_end_date) : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="loan_amount">Monto original del préstamo *</Label>
          <Input
            id="loan_amount"
            name="loan_amount"
            type="number"
            step="0.01"
            defaultValue={account?.loan_amount ?? defaults.loan_amount ?? ""}
            placeholder="Ej: 10000000"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="monthly_payment">Cuota mensual</Label>
          <Input
            id="monthly_payment"
            name="monthly_payment"
            type="number"
            step="0.01"
            defaultValue={account?.monthly_payment ?? defaults.monthly_payment ?? ""}
            placeholder="Ej: 350000"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="interest_rate">Tasa de interés anual (%)</Label>
        <Input
          id="interest_rate"
          name="interest_rate"
          type="number"
          step="any"
          min="0"
          max="100"
          defaultValue={account?.interest_rate ?? defaults.interest_rate ?? ""}
          placeholder="Ej: 12.5"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Inicio del préstamo</Label>
          <div className="flex gap-2">
            <Select name="loan_start_month" defaultValue={(startDate ? startDate.getUTCMonth() + 1 : defaults.loan_start_month)?.toString()}>
              <SelectTrigger>
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select name="loan_start_year" defaultValue={(startDate ? startDate.getUTCFullYear() : defaults.loan_start_year)?.toString()}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                {generateYears(currentYear - 10, 15).map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label>Fin del préstamo</Label>
          <div className="flex gap-2">
            <Select name="loan_end_month" defaultValue={(endDate ? endDate.getUTCMonth() + 1 : defaults.loan_end_month)?.toString()}>
              <SelectTrigger>
                <SelectValue placeholder="Mes" />
              </SelectTrigger>
              <SelectContent>
                {MONTHS.map((m, i) => (
                  <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select name="loan_end_year" defaultValue={(endDate ? endDate.getUTCFullYear() : defaults.loan_end_year)?.toString()}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Año" />
              </SelectTrigger>
              <SelectContent>
                {generateYears(currentYear, 20).map(y => (
                  <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </>
  );
}

// Investment Fields Component
function InvestmentFields({ account, defaults }: { account?: Account; defaults: AccountFormDefaults }) {
  const currentYear = getCurrentYear();

  const maturityDate = account?.maturity_date ? new Date(account.maturity_date) : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="initial_investment">Inversión inicial</Label>
          <Input
            id="initial_investment"
            name="initial_investment"
            type="number"
            step="0.01"
            defaultValue={account?.initial_investment ?? defaults.initial_investment ?? ""}
            placeholder="Ej: 5000000"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="expected_return_rate">Rendimiento esperado (%)</Label>
          <Input
            id="expected_return_rate"
            name="expected_return_rate"
            type="number"
            step="0.01"
            min="0"
            max="100"
            defaultValue={account?.expected_return_rate ?? defaults.expected_return_rate ?? ""}
            placeholder="Ej: 8.5"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Fecha de vencimiento</Label>
        <div className="flex gap-2">
          <Select name="maturity_month" defaultValue={(maturityDate ? maturityDate.getUTCMonth() + 1 : defaults.maturity_month)?.toString()}>
            <SelectTrigger>
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={(i + 1).toString()}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select name="maturity_year" defaultValue={(maturityDate ? maturityDate.getUTCFullYear() : defaults.maturity_year)?.toString()}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Año" />
            </SelectTrigger>
            <SelectContent>
              {generateYears(currentYear, 25).map(y => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">
          Fecha en que vence o se liquida la inversión
        </p>
      </div>
    </>
  );
}

export function SpecializedAccountForm({ account, defaultValues, onSuccess }: Props) {
  const [selectedType, setSelectedType] = useState(account?.account_type ?? defaultValues?.account_type ?? "CHECKING");
  
  const action = account
    ? updateAccount.bind(null, account.id)
    : createAccount;

  const [state, formAction, pending] = useActionState<ActionResult<Account>, FormData>(
    async (prevState, formData) => {
      const result = await action(prevState, formData);
      if (result.success) onSuccess?.(result.data);
      return result;
    },
    { success: false, error: "" }
  );

  const dv = defaultValues ?? {};
  const selectedTypeInfo = ACCOUNT_TYPES.find(t => t.value === selectedType);

  return (
    <form action={formAction} className="space-y-6">
      {!state.success && state.error && (
        <div className="bg-destructive/10 text-destructive text-sm rounded-md p-3">
          {state.error}
        </div>
      )}

      {dv.mask && <input type="hidden" name="mask" value={dv.mask} />}

      <input type="hidden" name="account_type" value={selectedType} />

      {/* Account Type Selection */}
      <div className="space-y-3">
        <Label>Tipo de cuenta</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {account ? (
            // In edit mode, just show the current type
            <div className="col-span-full flex items-center gap-3 p-3 border rounded-lg bg-muted/50">
              {selectedTypeInfo && (
                <>
                  <selectedTypeInfo.icon className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{selectedTypeInfo.label}</p>
                    <p className="text-xs text-muted-foreground">{selectedTypeInfo.description}</p>
                  </div>
                </>
              )}
            </div>
          ) : (
            // In create mode, show selection grid
            ACCOUNT_TYPES.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedType === type.value;
              return (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setSelectedType(type.value)}
                  className={`flex flex-col items-start gap-2 p-3 rounded-lg border text-left transition-all ${
                    isSelected 
                      ? "border-primary bg-primary/5 ring-1 ring-primary" 
                      : "border-border hover:border-muted-foreground/30 hover:bg-muted/50"
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                  <div>
                    <p className={`font-medium text-sm ${isSelected ? "text-foreground" : ""}`}>{type.label}</p>
                    <p className="text-xs text-muted-foreground leading-tight">{type.description}</p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Common Fields */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Nombre de la cuenta *</Label>
          <Input
            id="name"
            name="name"
            defaultValue={account?.name ?? dv.name}
            placeholder={`Ej: Mi ${selectedTypeInfo?.label ?? "Cuenta"}`}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="institution_name">Institución financiera</Label>
            <Input
              id="institution_name"
              name="institution_name"
              defaultValue={account?.institution_name ?? dv.institution_name ?? ""}
              placeholder="Ej: Bancolombia"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency_code">Moneda</Label>
            <Select name="currency_code" defaultValue={account?.currency_code ?? dv.currency_code ?? "COP"}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} - {c.name_es}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="current_balance">Saldo actual *</Label>
          <Input
            id="current_balance"
            name="current_balance"
            type="number"
            step="0.01"
            defaultValue={account?.current_balance ?? dv.current_balance ?? 0}
            placeholder="0"
            required
          />
          <p className="text-xs text-muted-foreground">
            Para tarjetas de crédito, ingrese el monto que debe como valor positivo
          </p>
        </div>

        {/* Type-specific fields */}
        {selectedType === "CREDIT_CARD" && (
          <CreditCardFields account={account} defaults={dv} />
        )}

        {selectedType === "LOAN" && (
          <LoanFields account={account} defaults={dv} />
        )}

        {selectedType === "INVESTMENT" && (
          <InvestmentFields account={account} defaults={dv} />
        )}

        <div className="space-y-2">
          <Label htmlFor="color">Color de la cuenta</Label>
          <div className="flex items-center gap-3">
            <Input
              id="color"
              name="color"
              type="color"
              defaultValue={account?.color ?? dv.color ?? "#6366f1"}
              className="h-10 w-20"
            />
            <span className="text-sm text-muted-foreground">
              Elija un color para identificar esta cuenta
            </span>
          </div>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending
          ? "Guardando..."
          : account
            ? "Actualizar cuenta"
            : "Crear cuenta"}
      </Button>
    </form>
  );
}
