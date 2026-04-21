import Link from "next/link";
import { UserPlus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Banner shown when the visitor is signed in anonymously and is NOT in
 * demo mode — i.e., they opted into the "Usar sin cuenta" flow and are
 * building their own data under an anonymous session. Always invites them
 * to convert to a real account to avoid data loss.
 */
export function GuestBanner() {
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-z-brass/20 bg-z-brass/8 px-4 py-2.5">
      <div className="flex items-center gap-2.5 text-sm">
        <UserRound className="size-4 shrink-0 text-z-brass" />
        <span className="font-medium text-z-brass">Sin cuenta</span>
        <span className="text-muted-foreground">
          — Crea cuenta para no perder tus datos
        </span>
      </div>
      <Button
        asChild
        size="sm"
        className="h-7 gap-1.5 bg-z-brass px-2.5 text-xs text-z-ink hover:bg-z-brass/90"
      >
        <Link href="/signup">
          <UserPlus className="size-3.5" />
          Crear cuenta
        </Link>
      </Button>
    </div>
  );
}
