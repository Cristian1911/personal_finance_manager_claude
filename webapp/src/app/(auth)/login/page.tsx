import { LoginForm } from "@/components/auth/login-form";

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
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Iniciar sesión</h2>
        <p className="text-sm text-muted-foreground">
          Ingresa tus credenciales para acceder
        </p>
      </div>
      {callbackError && (
        <div className="bg-destructive/10 text-destructive text-sm rounded-md p-3">
          {callbackError}
        </div>
      )}
      <LoginForm />
    </div>
  );
}
