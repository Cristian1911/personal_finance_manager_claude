"use client";

import { useActionState } from "react";
import { signUp, type AuthActionResult } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function SignupForm() {
  const [state, formAction, pending] = useActionState<AuthActionResult, FormData>(
    signUp,
    {}
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <div className="bg-destructive/10 text-destructive text-sm rounded-md p-3">
          {state.error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="email">Correo electrónico</Label>
        <Input
          id="email"
          name="email"
          type="email"
          placeholder="tu@email.com"
          required
          autoComplete="email"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          placeholder="••••••••"
          required
          minLength={8}
          autoComplete="new-password"
        />
        <p className="text-xs text-muted-foreground">
          Mínimo 8 caracteres. Te pediremos tu nombre en el siguiente paso.
        </p>
      </div>

      <Button type="submit" className={cn("w-full", BRASS_BUTTON_CLASS)} disabled={pending}>
        {pending ? "Creando cuenta..." : "Crear cuenta"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-primary hover:underline font-medium">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
