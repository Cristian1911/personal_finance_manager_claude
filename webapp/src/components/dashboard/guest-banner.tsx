import Link from "next/link";
import { UserPlus, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRASS_BUTTON_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";

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
        <span className="text-z-sage-dark">
          — Tus datos se mantienen al crear cuenta
        </span>
      </div>
      <Button
        asChild
        size="sm"
        className={cn(BRASS_BUTTON_CLASS, "h-7 gap-1.5 px-2.5 text-xs")}
      >
        <Link href="/signup">
          <UserPlus className="size-3.5" />
          Crear cuenta
        </Link>
      </Button>
    </div>
  );
}
