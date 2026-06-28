"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";

/**
 * Back affordance that returns the user to where they actually were
 * (browser history), falling back to `fallbackHref` only when there is no
 * history to pop. Use `exit` for focus-mode "salir" (X) treatment.
 */
export function MobileBackButton({
  fallbackHref = "/dashboard",
  exit = false,
}: {
  fallbackHref?: string;
  exit?: boolean;
}) {
  const router = useRouter();
  const Icon = exit ? X : ArrowLeft;
  return (
    <button
      type="button"
      onClick={() => {
        if (window.history.length > 1) {
          router.back();
        } else {
          router.push(fallbackHref);
        }
      }}
      className="flex size-8 shrink-0 items-center justify-center rounded-full text-z-sage-light transition-colors hover:bg-white/5"
      aria-label={exit ? "Salir" : "Volver"}
    >
      <Icon className="size-4" />
    </button>
  );
}
