"use client";

import Link from "next/link";
import {
  Brain,
  CalendarClock,
  Contact,
  FileUp,
  Folder,
  Heart,
  Landmark,
  List,
  PiggyBank,
  Settings,
  Tag,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useNavFocus } from "@/components/providers/nav-focus-provider";
import { SECTION_EYEBROW_CLASS } from "@/lib/constants/styles";

type Tile = { href: string; icon: LucideIcon; label: string };
type Group = { title: string; tiles: Tile[] };

const CUENTAS_GROUP: Group = {
  title: "Cuentas y saldos",
  tiles: [
    { href: "/accounts", icon: Wallet, label: "Cuentas" },
    { href: "/import", icon: FileUp, label: "Importar" },
  ],
};

const ORGANIZAR_GROUP: Group = {
  title: "Organizar",
  tiles: [
    { href: "/categorizar", icon: List, label: "Categorizar" },
    { href: "/plan?tab=presupuesto", icon: Folder, label: "Categorías" },
    { href: "/destinatarios", icon: Contact, label: "Destinatarios" },
    { href: "/etiquetas", icon: Tag, label: "Etiquetas" },
  ],
};

const PLAN_TILE: Tile = { href: "/plan", icon: PiggyBank, label: "Plan" };
const DEUDAS_TILE: Tile = { href: "/deudas", icon: Landmark, label: "Deudas" };
const DEUDAS_PERSONALES_TILE: Tile = {
  href: "/deudas-personales",
  icon: Users,
  label: "Deudas personales",
};
const RECURRENTES_TILE: Tile = {
  href: "/plan?tab=recurrentes",
  icon: CalendarClock,
  label: "Recurrentes",
};
const DESEOS_TILE: Tile = { href: "/deseos", icon: Heart, label: "Deseos" };
const PUEDO_PAGAR_TILE: Tile = { href: "/puedo-pagar", icon: Brain, label: "¿Comprarlo?" };

const ANALISIS_GROUP: Group = {
  title: "Análisis",
  tiles: [{ href: "/tendencias", icon: TrendingUp, label: "Tendencias" }],
};

const SISTEMA_GROUP: Group = {
  title: "Sistema",
  tiles: [{ href: "/settings", icon: Settings, label: "Ajustes" }],
};

export function MobileLinkGrid() {
  const focus = useNavFocus();

  // The active third tab lives in the bottom nav — surface the OTHER one in the grid.
  const planificarTiles: Tile[] = [
    focus === "DEBT" ? PLAN_TILE : DEUDAS_TILE,
    DEUDAS_PERSONALES_TILE,
    RECURRENTES_TILE,
    DESEOS_TILE,
    PUEDO_PAGAR_TILE,
  ];
  const planificarGroup: Group = { title: "Planificar", tiles: planificarTiles };

  const groups: Group[] = [
    CUENTAS_GROUP,
    ANALISIS_GROUP,
    ORGANIZAR_GROUP,
    planificarGroup,
    SISTEMA_GROUP,
  ];

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.title} className="space-y-2">
          <h3 className={SECTION_EYEBROW_CLASS}>{group.title}</h3>
          <div className="grid grid-cols-3 gap-3 lg:grid-cols-4">
            {group.tiles.map(({ href, icon: Icon, label }) => (
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
        </section>
      ))}
    </div>
  );
}
