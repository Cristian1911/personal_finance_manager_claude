"use client";

import { useActionState, useState } from "react";
import { PiggyBank, Landmark } from "lucide-react";
import { updateProfile } from "@/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES } from "@/lib/constants/currencies";
import { cn } from "@/lib/utils";
import type { ActionResult } from "@/types/actions";
import type { Profile } from "@/types/domain";
import type { Database } from "@/types/database";
import { toast } from "sonner";

type NavFocus = Database["public"]["Enums"]["nav_focus"];

export function ProfileForm({ profile }: { profile: Profile }) {
  const [navFocus, setNavFocus] = useState<NavFocus>(profile.nav_focus ?? "PLAN");
  const [state, formAction, pending] = useActionState<
    ActionResult<Profile>,
    FormData
  >(
    async (prevState, formData) => {
      const result = await updateProfile(prevState, formData);
      if (result.success) toast.success("Perfil actualizado");
      return result;
    },
    { success: false, error: "" }
  );

  return (
    <form action={formAction} className="space-y-4">
      {!state.success && state.error && (
        <div className="bg-destructive/10 text-destructive text-sm rounded-md p-3">
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="full_name">Nombre completo</Label>
        <Input
          id="full_name"
          name="full_name"
          defaultValue={profile.full_name ?? ""}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="preferred_currency">Moneda principal</Label>
        <Select
          name="preferred_currency"
          defaultValue={profile.preferred_currency}
        >
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

      <div className="space-y-2">
        <Label htmlFor="monthly_salary">Salario mensual estimado</Label>
        <CurrencyInput
          id="monthly_salary"
          name="monthly_salary"
          defaultValue={profile.monthly_salary ?? ""}
          placeholder="Ej: 4.500.000"
        />
        <p className="text-xs text-muted-foreground">
          Se usa para calcular la distribución de tu salario en deudas. Si no lo defines, se estimará desde tus transacciones.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Foco principal</Label>
        <p className="text-xs text-muted-foreground">
          Define qué pestaña ves como tercera opción en la barra inferior. Cámbialo cuando quieras.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {([
            { value: "PLAN" as const, label: "Plan", description: "Presupuestos y metas", Icon: PiggyBank },
            { value: "DEBT" as const, label: "Deudas", description: "Tarjetas y pagos", Icon: Landmark },
          ]).map(({ value, label, description, Icon }) => {
            const active = navFocus === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setNavFocus(value)}
                aria-pressed={active}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border px-3 py-3 text-left transition-colors",
                  active
                    ? "border-z-brass/40 bg-z-brass/10 text-foreground"
                    : "border-white/6 bg-z-surface-2/60 text-muted-foreground hover:bg-white/5"
                )}
              >
                <span className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className={cn("size-4", active ? "text-z-brass" : "text-muted-foreground")} />
                  {label}
                </span>
                <span className="text-xs">{description}</span>
              </button>
            );
          })}
        </div>
      </div>

      <input type="hidden" name="locale" value={profile.locale} />
      <input type="hidden" name="timezone" value={profile.timezone} />
      <input type="hidden" name="nav_focus" value={navFocus} />

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
