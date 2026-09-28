import { useState } from "react";
import { View, ScrollView, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import {
  Brain,
  CalendarClock,
  CalendarRange,
  ChevronDown,
  ChevronUp,
  Contact,
  FileUp,
  Folder,
  Heart,
  Landmark,
  List,
  PiggyBank,
  Repeat,
  Settings,
  Tag,
  TrendingUp,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react-native";
import { MobileHeader } from "../../components/ui/MobileHeader";
import { AvatarMenuTrigger } from "../../components/ui/AvatarMenu";
import {
  PANEL_SURFACE_CLASS,
  SECTION_EYEBROW_CLASS,
  MOBILE_TAB_BAR_CLEARANCE,
} from "../../lib/constants/styles";
import { COLORS } from "../../lib/constants/colors";
import { useNavFocus } from "../../lib/profile";

type Tile = { href: string; icon: LucideIcon; label: string };
type Group = { title: string; tiles: Tile[] };

const CUENTAS_GROUP: Group = {
  title: "Cuentas y saldos",
  tiles: [
    { href: "/accounts-list", icon: Wallet, label: "Cuentas" },
    { href: "/(tabs)/import", icon: FileUp, label: "Importar" },
  ],
};

// Los grupos siguen la historia de la app: meter el dinero, entenderlo,
// planificar — mismo recorte que `webapp/src/components/mobile/mobile-link-grid.tsx`.
// `/modos` ("Viajes y eventos") no tiene ruta móvil todavía — BACKLOG.
const ENTENDER_GROUP: Group = {
  title: "Entender",
  tiles: [
    { href: "/destinatarios", icon: Contact, label: "Destinatarios" },
    { href: "/tendencias", icon: TrendingUp, label: "Tendencias" },
  ],
};

const SISTEMA_GROUP: Group = {
  title: "Sistema",
  tiles: [{ href: "/settings", icon: Settings, label: "Ajustes" }],
};

const PLAN_TILE: Tile = { href: "/plan", icon: PiggyBank, label: "Plan" };
const DEUDAS_TILE: Tile = { href: "/deudas", icon: Landmark, label: "Deudas" };
const RECURRENTES_TILE: Tile = {
  href: "/recurrentes",
  icon: CalendarClock,
  label: "Recurrentes",
};

// Aparcadas fuera de la nav principal (recorte 2026-09-15). Rutas y datos intactos.
// ponytail: Suscripciones sigue aquí hasta que se pliegue dentro de Recurrentes
// como en la webapp (audit 2026-09-22, P1-12); sin tile quedaría inalcanzable.
const ADVANCED_TILES: Tile[] = [
  { href: "/categorizar", icon: List, label: "Categorizar" },
  { href: "/categories", icon: Folder, label: "Categorías" },
  { href: "/etiquetas", icon: Tag, label: "Etiquetas" },
  { href: "/periodo", icon: CalendarRange, label: "Periodo" },
  { href: "/deseos", icon: Heart, label: "Deseos" },
  { href: "/purchase-decision", icon: Brain, label: "¿Comprarlo?" },
  { href: "/personas", icon: Users, label: "Deudas personales" },
  { href: "/subscriptions", icon: Repeat, label: "Suscripciones" },
];

function TileGrid({ tiles }: { tiles: Tile[] }) {
  const router = useRouter();
  return (
    <View className="flex-row flex-wrap gap-3">
      {tiles.map(({ href, icon: Icon, label }) => (
        <Pressable
          key={href}
          onPress={() => router.push(href as never)}
          accessibilityRole="button"
          accessibilityLabel={label}
          // 3 per row: each tile is a third of the width minus the gaps.
          className={`${PANEL_SURFACE_CLASS} w-[31%] items-center gap-2 px-2 py-4`}
        >
          <Icon size={20} color={COLORS.sageDark} />
          <Text
            className="text-center text-[11px] font-inter-medium text-foreground"
            numberOfLines={2}
          >
            {label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export default function MenuScreen() {
  const focus = useNavFocus();

  // The active third tab already lives in the bottom bar — surface the OTHER
  // one here, same rule as the webapp's MobileLinkGrid.
  const groups: Group[] = [
    CUENTAS_GROUP,
    ENTENDER_GROUP,
    {
      title: "Planificar",
      tiles: [RECURRENTES_TILE, focus === "DEBT" ? PLAN_TILE : DEUDAS_TILE],
    },
    SISTEMA_GROUP,
  ];
  // Cerrada por defecto y sin persistir, como en la webapp.
  const [advancedOpen, setAdvancedOpen] = useState(false);

  return (
    <View className="flex-1 bg-background">
      <MobileHeader variant="main" title="Más" right={<AvatarMenuTrigger />} />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 16,
          gap: 20,
          paddingBottom: MOBILE_TAB_BAR_CLEARANCE,
        }}
      >
        {groups.map((group) => (
          <View key={group.title} className="gap-2">
            <Text className={SECTION_EYEBROW_CLASS}>{group.title}</Text>
            <TileGrid tiles={group.tiles} />
          </View>
        ))}

        <View className="gap-2 border-t border-white-6 pt-3">
          <Pressable
            onPress={() => setAdvancedOpen((open) => !open)}
            accessibilityRole="button"
            accessibilityState={{ expanded: advancedOpen }}
            accessibilityLabel={`Herramientas avanzadas, ${ADVANCED_TILES.length} herramientas`}
            className="flex-row items-center justify-between py-2"
          >
            <Text className={SECTION_EYEBROW_CLASS}>Herramientas avanzadas</Text>
            <View className="flex-row items-center gap-2">
              <Text className="text-[11px] font-inter text-muted-foreground">
                {ADVANCED_TILES.length}
              </Text>
              {advancedOpen ? (
                <ChevronUp size={16} color={COLORS.sageDark} />
              ) : (
                <ChevronDown size={16} color={COLORS.sageDark} />
              )}
            </View>
          </Pressable>
          {advancedOpen && <TileGrid tiles={ADVANCED_TILES} />}
        </View>
      </ScrollView>
    </View>
  );
}
