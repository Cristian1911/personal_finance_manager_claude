import { SignupForm } from "@/components/auth/signup-form";
import { AuthSessionShortcuts } from "@/components/auth/auth-session-shortcuts";
import { createClient } from "@/lib/supabase/server";
import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";

export default async function SignupPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const fromGuest = data.user?.is_anonymous === true;

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          {fromGuest ? "Guarda tus datos." : "Conoce adónde va tu plata."}
        </h2>
        <p className="text-sm text-muted-foreground">
          {fromGuest
            ? "Crea tu cuenta para no perder nada de lo que ya configuraste."
            : "Importa una vez. Nosotros categorizamos el resto."}
        </p>
      </div>
      <div className={cn(PANEL_SURFACE_CLASS, "p-6")}>
        <SignupForm fromGuest={fromGuest} />
      </div>
      {!fromGuest && <AuthSessionShortcuts />}
    </div>
  );
}
