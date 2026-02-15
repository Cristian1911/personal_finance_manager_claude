import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Crear cuenta</h2>
        <p className="text-sm text-muted-foreground">
          Comienza a gestionar tus finanzas personales
        </p>
      </div>
      <SignupForm />
    </div>
  );
}
