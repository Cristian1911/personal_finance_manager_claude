"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

export function MobileBackButton({ fallbackHref = "/dashboard" }: { fallbackHref?: string }) {
  const router = useRouter();
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
      aria-label="Volver"
    >
      <ArrowLeft className="size-4" />
    </button>
  );
}
