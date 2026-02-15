import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Recuperar contraseña</h2>
        <p className="text-sm text-muted-foreground">
          Te enviaremos un enlace para restablecer tu contraseña
        </p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
