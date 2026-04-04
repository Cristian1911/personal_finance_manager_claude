"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GHOST_BUTTON_CLASS } from "@/lib/constants/styles";
import { cn } from "@/lib/utils";

interface MobilePageHeaderProps {
  title: string;
  backHref?: string;
  children?: React.ReactNode;
}

export function MobilePageHeader({
  title,
  backHref,
  children,
}: MobilePageHeaderProps) {
  const router = useRouter();

  return (
    <div className="mb-5 flex items-center gap-3 lg:hidden">
      <Button
        variant="ghost"
        size="icon"
        className={cn(
          "size-9 shrink-0 rounded-full",
          GHOST_BUTTON_CLASS
        )}
        onClick={() => (backHref ? router.push(backHref) : router.back())}
      >
        <ArrowLeft className="size-4" />
        <span className="sr-only">Volver</span>
      </Button>
      <h1 className="flex-1 truncate text-base font-semibold tracking-tight text-z-white">
        {title}
      </h1>
      {children}
    </div>
  );
}
