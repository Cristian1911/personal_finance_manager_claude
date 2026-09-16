"use client";

import Link from "next/link";
import {
  Brain,
  CalendarClock,
  CalendarRange,
  ChevronDown,
  Contact,
  FileUp,
  Folder,
  Heart,
  Landmark,
  List,
  MapPin,
  PiggyBank,
  Settings,
  Tag,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useNavFocus } from "@/components/providers/nav-focus-provider";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";

type Tile = { href: string; icon: LucideIcon; label: string };
type Group = { title: string; tiles: Tile[] };

// Los grupos siguen la historia de la app: meter el dinero, entenderlo, planificar.
const CUENTAS_GROUP: Group = {
  title: "Cuentas y saldos",
  tiles: [
    { href: "/accounts", icon: Wallet, label: "Cuentas" },
    { href: "/import", icon: FileUp, label: "Importar" },
  ],
};

const ENTENDER_GROUP: Group = {
  title: "Entender",
  tiles: [
    { href: "/destinatarios", icon: Contact, label: "Destinatarios" },
    { href: "/tendencias", icon: TrendingUp, label: "Tendencias" },
    { href: "/modos", icon: MapPin, label: "Viajes y eventos" },
  ],
};

const PLAN_TILE: Tile = { href: "/plan", icon: PiggyBank, label: "Plan" };
const DEUDAS_TILE: Tile = { href: "/deudas", icon: Landmark, label: "Deudas" };
const RECURRENTES_TILE: Tile = {
  href: "/plan?tab=recurrentes",
  icon: CalendarClock,
  label: "Recurrentes",
};

const SISTEMA_GROUP: Group = {
  title: "Sistema",
  tiles: [{ href: "/settings", icon: Settings, label: "Ajustes" }],
};

// Aparcadas fuera de la nav principal (2026-09-15). Rutas y datos intactos.
// "Viajes y eventos" (/modos) salió de aquí a Entender el 2026-09-16.
const ADVANCED_TILES: Tile[] = [
  { href: "/categorizar", icon: List, label: "Categorizar" },
  { href: "/categories", icon: Folder, label: "Categorías" },
  { href: "/etiquetas", icon: Tag, label: "Etiquetas" },
  { href: "/plan?tab=periodo", icon: CalendarRange, label: "Periodo" },
  { href: "/deseos", icon: Heart, label: "Deseos" },
  { href: "/puedo-pagar", icon: Brain, label: "¿Comprarlo?" },
  { href: "/deudas-personales", icon: Users, label: "Deudas personales" },
];

function TileGrid({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid grid-cols-3 gap-3 lg:grid-cols-4">
      {tiles.map(({ href, icon: Icon, label }) => (
        <Link
          key={href}
          href={href}
          className="flex flex-col items-center gap-2 rounded-2xl border border-white/6 bg-z-surface-2/80 px-3 py-4 transition-colors hover:bg-white/5"
        >
          <Icon className="size-5 text-muted-foreground" />
          <span className="text-xs font-medium">{label}</span>
        </Link>
      ))}
    </div>
  );
}

export function MobileLinkGrid() {
  const focus = useNavFocus();

  // The active third tab lives in the bottom nav — surface the OTHER one in the grid.
  const planificarGroup: Group = {
    title: "Planificar",
    tiles: [RECURRENTES_TILE, focus === "DEBT" ? PLAN_TILE : DEUDAS_TILE],
  };

  const groups: Group[] = [CUENTAS_GROUP, ENTENDER_GROUP, planificarGroup, SISTEMA_GROUP];

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.title} className="space-y-2">
          <h3 className={SECTION_EYEBROW_CLASS}>{group.title}</h3>
          <TileGrid tiles={group.tiles} />
        </section>
      ))}

      {/* Cerrada por defecto y sin persistir; si hace falta recordar el estado, localStorage. */}
      <Collapsible className="space-y-2 border-t border-white/6 pt-3">
        <CollapsibleTrigger className="group flex w-full items-center justify-between gap-3 py-2 text-left">
          <span className={SECTION_EYEBROW_CLASS}>Herramientas avanzadas</span>
          <span className="flex items-center gap-2 text-muted-foreground">
            <span className="text-[11px] tabular-nums">{ADVANCED_TILES.length}</span>
            <ChevronDown
              className="size-4 transition-transform group-data-[state=open]:rotate-180"
              aria-hidden
            />
          </span>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <TileGrid tiles={ADVANCED_TILES} />
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
