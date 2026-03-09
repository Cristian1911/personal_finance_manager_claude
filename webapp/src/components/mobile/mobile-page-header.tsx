"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="flex items-center gap-3 mb-4 lg:hidden">
      <Button
        variant="ghost"
        size="icon"
        className="size-8 shrink-0"
        onClick={() => (backHref ? router.push(backHref) : router.back())}
      >
        <ArrowLeft className="size-4" />
        <span className="sr-only">Volver</span>
      </Button>
      <h1 className="text-lg font-semibold flex-1 truncate">{title}</h1>
      {children}
    </div>
  );
}
