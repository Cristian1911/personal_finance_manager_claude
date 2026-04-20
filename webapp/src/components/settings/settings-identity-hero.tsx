import { signOut } from "@/actions/auth";
import { cn } from "@/lib/utils";
import { BRASS_GHOST_BUTTON_CLASS } from "@/lib/constants/styles";

interface SettingsIdentityHeroProps {
  name: string;
  email: string;
  memberSince: string;
}

function initials(name: string, fallback: string): string {
  const trimmed = name.trim();
  if (!trimmed) return fallback.slice(0, 2).toUpperCase();
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]).join("").toUpperCase();
}

export function SettingsIdentityHero({ name, email, memberSince }: SettingsIdentityHeroProps) {
  const chipText = initials(name, email);
  const displayName = name.trim() || "Sin nombre";

  return (
    <div className="flex items-center gap-4">
      <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-z-brass/30 bg-z-brass/10">
        <span className="text-lg font-bold tracking-tight text-z-brass">{chipText}</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-semibold text-foreground">{displayName}</p>
        <p className="truncate text-xs text-muted-foreground">
          {email} · Miembro desde {memberSince}
        </p>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className={cn(BRASS_GHOST_BUTTON_CLASS, "rounded-lg border px-2.5 py-1 text-xs font-semibold")}
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
