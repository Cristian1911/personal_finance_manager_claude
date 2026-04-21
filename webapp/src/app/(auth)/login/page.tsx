import { LoginForm } from "@/components/auth/login-form";
import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";

const CALLBACK_ERROR_MESSAGES: Record<string, string> = {
  auth_callback_failed: "No pudimos validar el enlace. Solicita uno nuevo.",
  auth_callback_missing_params: "El enlace no es válido. Solicita uno nuevo.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string }>;
}) {
  const { error, reason } = await searchParams;
  const callbackError = error
    ? CALLBACK_ERROR_MESSAGES[error] ?? reason ?? "No pudimos iniciar sesión. Intenta nuevamente."
    : null;

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold tracking-tight">Bienvenido de nuevo.</h2>
        <p className="text-sm text-muted-foreground">
          Ingresa para ver tu día en una pantalla.
        </p>
      </div>
      {callbackError && (
        <div className="bg-destructive/10 text-destructive text-sm rounded-md p-3">
          {callbackError}
        </div>
      )}
      <div className={cn(PANEL_SURFACE_CLASS, "p-6")}>
        <LoginForm />
      </div>
    </div>
  );
}
