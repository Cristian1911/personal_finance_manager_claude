import { SignupForm } from "@/components/auth/signup-form";
import { startDemoSession, startGuestSession } from "@/actions/demo";
import { PANEL_SURFACE_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          Conoce adónde va tu plata.
        </h2>
        <p className="text-sm text-muted-foreground">
          Importa una vez. Nosotros categorizamos el resto.
        </p>
      </div>
      <div className={cn(PANEL_SURFACE_CLASS, "p-6")}>
        <SignupForm />
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <form action={startGuestSession}>
          <button
            type="submit"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Usar sin cuenta →
          </button>
        </form>
        <form action={startDemoSession}>
          <button
            type="submit"
            className="text-xs text-muted-foreground/80 underline-offset-4 hover:text-foreground hover:underline"
          >
            o ver el demo con datos de ejemplo
          </button>
        </form>
      </div>
    </div>
  );
}
