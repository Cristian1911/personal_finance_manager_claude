"use client";

import { useActionState } from "react";
import { resetPasswordRequest, type AuthActionResult } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";

export function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthActionResult, FormData>(
    resetPasswordRequest,
    {}
  );

  if (state.success) {
    return (
      <div className="text-center space-y-4">
        <div className="bg-primary/10 text-primary rounded-md p-4">
          <p className="font-medium">¡Enlace enviado!</p>
          <p className="text-sm mt-1">
            Revisa tu correo para restablecer tu contraseña.
          </p>
        </div>
        <Link href="/login" className="text-sm text-primary hover:underline">
          Volver al inicio de sesión
        </Link>
      </div>
    );
  }

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

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Enviando..." : "Enviar enlace de recuperación"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/login" className="text-primary hover:underline">
          Volver al inicio de sesión
        </Link>
      </p>
    </form>
  );
}
