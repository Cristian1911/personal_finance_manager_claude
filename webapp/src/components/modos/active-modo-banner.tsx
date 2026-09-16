"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { MapPin, X } from "lucide-react";
import { toast } from "sonner";
import { setActiveModo } from "@/actions/modos";
import { useActiveModo } from "@/components/providers/app-data-provider";
import { Button } from "@/components/ui/button";
import { isFocusModePath } from "@/lib/constants/mobile-nav";
import { formatDate } from "@/lib/utils/date";

/**
 * "Estás en un viaje": one thin strip under the page header while a modo is
 * active. Same shell as DemoBanner so the two stack without fighting. Hidden
 * on focus-mode routes (forms, wizards) — the user is mid-task there.
 */
export function ActiveModoBanner() {
  const modo = useActiveModo();
  const pathname = usePathname();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  if (!modo || isFocusModePath(pathname) || pathname.startsWith(`/modos/${modo.id}`)) return null;

  function finish() {
    startTransition(async () => {
      const res = await setActiveModo(null);
      if (res.success) {
        toast.success("Viaje terminado. Lo que registres ya no se etiqueta solo.");
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-z-brass/20 bg-z-brass/8 px-4 py-2.5">
      <Link href={`/modos/${modo.id}`} className="flex min-w-0 items-center gap-2.5 text-sm">
        <span className="shrink-0 text-base leading-none" aria-hidden>
          {modo.emoji ?? <MapPin className="size-4 text-z-brass" />}
        </span>
        <span className="truncate font-medium text-z-brass">{modo.name}</span>
        <span className="hidden truncate text-muted-foreground sm:inline">
          · viaje activo · lo que registres a mano se etiqueta solo · hasta{" "}
          {formatDate(modo.date_to, "d MMM")}
        </span>
        <span className="truncate text-muted-foreground sm:hidden">· viaje activo</span>
      </Link>
      <Button
        variant="ghost"
        size="sm"
        onClick={finish}
        disabled={pending}
        className="h-7 shrink-0 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
      >
        <X className="size-3.5" />
        Terminar
      </Button>
    </div>
  );
}
