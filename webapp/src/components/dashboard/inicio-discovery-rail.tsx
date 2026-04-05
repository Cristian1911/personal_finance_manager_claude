import Link from "next/link";
import { ShoppingBag, MapPin, ChevronRight } from "lucide-react";
import { PANEL_INSET_INTERACTIVE_CLASS } from "@/lib/constants/styles";

interface InicioDiscoveryRailProps {
  compressed?: boolean;
}

const discoveries = [
  {
    href: "/deseos",
    icon: ShoppingBag,
    title: "Recomendador de compras",
    hint: "Evalúa si puedes comprar algo hoy sin afectar tu plan",
  },
  {
    href: "/plan",
    icon: MapPin,
    title: "Mapa del mes",
    hint: "Visualiza cómo se reparte tu gasto en el tiempo",
  },
] as const;

export function InicioDiscoveryRail({
  compressed = false,
}: InicioDiscoveryRailProps) {
  if (compressed) {
    return (
      <div className="flex gap-2">
        {discoveries.map((d) => (
          <Link
            key={d.href}
            href={d.href}
            className={`${PANEL_INSET_INTERACTIVE_CLASS} flex flex-1 items-center gap-2 px-3 py-2.5`}
          >
            <d.icon className="size-4 shrink-0 text-z-brass" />
            <span className="text-xs font-medium text-foreground truncate">
              {d.title}
            </span>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {discoveries.map((d) => (
        <Link
          key={d.href}
          href={d.href}
          className={`${PANEL_INSET_INTERACTIVE_CLASS} flex items-center gap-3 px-3.5 py-3 active:bg-white/[0.03]`}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl border border-white/6 bg-z-brass/10">
            <d.icon className="size-4 text-z-brass" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-tight text-foreground">
              {d.title}
            </p>
            <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
              {d.hint}
            </p>
          </div>
          <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
        </Link>
      ))}
    </div>
  );
}
