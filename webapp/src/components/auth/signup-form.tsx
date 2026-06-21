"use client";

import { useActionState } from "react";
import { signUp, type AuthActionResult } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface SignupFormProps {
  /** When true, signup will promote the current anonymous session in place
   *  — we surface a copy line so the user knows their data carries over. */
  fromGuest?: boolean;
}

export function SignupForm({ fromGuest = false }: SignupFormProps = {}) {
  const [state, formAction, pending] = useActionState<AuthActionResult, FormData>(
    signUp,
    {}
  );

  return (
    <form action={formAction} className="space-y-4">
      {fromGuest && (
        <div className="rounded-md border border-z-brass/20 bg-z-brass/8 p-3 text-xs text-z-brass">
          Tus datos se mantienen al crear la cuenta. Nada se pierde.
        </div>
      )}
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

      <OAuthButtons next="/dashboard" />

      <p className="text-center text-sm text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-primary hover:underline font-medium">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
