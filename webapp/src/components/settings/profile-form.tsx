"use client";

import { useActionState } from "react";
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
import type { ActionResult } from "@/types/actions";
import type { Profile } from "@/types/domain";
import { toast } from "sonner";

export function ProfileForm({ profile }: { profile: Profile }) {
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

      <input type="hidden" name="locale" value={profile.locale} />
      <input type="hidden" name="timezone" value={profile.timezone} />

      <Button type="submit" disabled={pending}>
        {pending ? "Guardando..." : "Guardar cambios"}
      </Button>
    </form>
  );
}
