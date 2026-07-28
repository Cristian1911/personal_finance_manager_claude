import { View, ScrollView, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
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

const ANALISIS_GROUP: Group = {
  title: "Análisis",
  tiles: [{ href: "/tendencias", icon: TrendingUp, label: "Tendencias" }],
};

// `/modos` has no mobile route yet — tracked in BACKLOG.md, not shown here.
const ORGANIZAR_GROUP: Group = {
  title: "Organizar",
  tiles: [
    { href: "/categorizar", icon: List, label: "Categorizar" },
    { href: "/categories", icon: Folder, label: "Categorías" },
    { href: "/destinatarios", icon: Contact, label: "Destinatarios" },
    { href: "/etiquetas", icon: Tag, label: "Etiquetas" },
  ],
};

const SISTEMA_GROUP: Group = {
  title: "Sistema",
  tiles: [{ href: "/settings", icon: Settings, label: "Ajustes" }],
};

const PLAN_TILE: Tile = { href: "/plan", icon: PiggyBank, label: "Plan" };
const DEUDAS_TILE: Tile = { href: "/deudas", icon: Landmark, label: "Deudas" };

export default function MenuScreen() {
  const router = useRouter();
  const focus = useNavFocus();

  // The active third tab already lives in the bottom bar — surface the OTHER
  // one here, same rule as the webapp's MobileLinkGrid.
  const groups: Group[] = [
    CUENTAS_GROUP,
    ANALISIS_GROUP,
    ORGANIZAR_GROUP,
    {
      title: "Planificar",
      tiles: [
        focus === "DEBT" ? PLAN_TILE : DEUDAS_TILE,
        { href: "/personas", icon: Users, label: "Personas" },
        { href: "/recurrentes", icon: CalendarClock, label: "Recurrentes" },
        { href: "/subscriptions", icon: Repeat, label: "Suscripciones" },
        { href: "/deseos", icon: Heart, label: "Deseos" },
        { href: "/purchase-decision", icon: Brain, label: "¿Comprarlo?" },
      ],
    },
    SISTEMA_GROUP,
  ];

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
            <View className="flex-row flex-wrap gap-3">
              {group.tiles.map(({ href, icon: Icon, label }) => (
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
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
