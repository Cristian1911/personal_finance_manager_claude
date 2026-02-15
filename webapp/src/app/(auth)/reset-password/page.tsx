import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Nueva contraseña</h2>
        <p className="text-sm text-muted-foreground">
          Ingresa tu nueva contraseña
        </p>
      </div>
      <ResetPasswordForm />
    </div>
  );
}
