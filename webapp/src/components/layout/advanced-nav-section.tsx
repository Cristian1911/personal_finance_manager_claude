"use client";

import { ChevronDown } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ADVANCED_NAV, isNavItemActive } from "@/lib/constants/navigation";

/** Sección colapsada del sidebar/sheet con las herramientas aparcadas.
 *  Se abre sola cuando la ruta actual vive dentro de ella: el sidebar persiste
 *  entre navegaciones, así que la `key` fuerza el remount al entrar o salir. */
export function AdvancedNavSection({
  pathname,
  children,
}: {
  pathname: string;
  children: React.ReactNode;
}) {
  const containsActive = ADVANCED_NAV.some((item) => isNavItemActive(pathname, item));

  return (
    <Collapsible
      key={String(containsActive)}
      defaultOpen={containsActive}
      className="space-y-1.5 pt-5"
    >
      <CollapsibleTrigger className="group flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground">
        Herramientas avanzadas
        <ChevronDown
          className="size-3.5 transition-transform group-data-[state=open]:rotate-180"
          aria-hidden
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <nav className="space-y-1">{children}</nav>
      </CollapsibleContent>
    </Collapsible>
  );
}
