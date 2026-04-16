import { View, Text, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Wallet, CalendarClock, RotateCcw, Heart } from "lucide-react-native";
import { MCardTight } from "../ui/MCard";
import { COLORS } from "../../lib/constants/colors";
import { MobileZone } from "../ui/MobileZone";

interface PlanDrillCardsProps {
  budgetOverLimit: number;
  budgetPct: number;
  recurringPending: number;
  wishlistCount: number;
}

interface CardDef {
  key: string;
  title: string;
  icon: typeof Wallet;
  hint: string;
  hintColor: string;
  route: string;
}

export function PlanDrillCards({
  budgetOverLimit,
  budgetPct,
  recurringPending,
  wishlistCount,
}: PlanDrillCardsProps) {
  const router = useRouter();

  const cards: CardDef[] = [
    {
      key: "presupuesto",
      title: "Presupuesto",
      icon: Wallet,
      hint: budgetOverLimit > 0 ? `${budgetOverLimit} sobre limite` : `${budgetPct}%`,
      hintColor: budgetOverLimit > 0 ? COLORS.debt : COLORS.income,
      route: "/(tabs)/budgets",
    },
    {
      key: "periodo",
      title: "Periodo",
      icon: CalendarClock,
      hint: `${budgetPct}%`,
      hintColor: budgetPct > 100 ? COLORS.debt : COLORS.income,
      route: "/periodo",
    },
    {
      key: "recurrentes",
      title: "Recurrentes",
      icon: RotateCcw,
      hint: `${recurringPending}`,
      hintColor: recurringPending > 0 ? COLORS.alert : COLORS.income,
      route: "/recurrentes",
    },
    {
      key: "deseos",
      title: "Deseos",
      icon: Heart,
      hint: `${wishlistCount}`,
      hintColor: COLORS.sageDark,
      route: "/deseos",
    },
  ];

  return (
    <MobileZone eyebrow="IR A">
      <MCardTight>
        <View className="flex-row flex-wrap">
          {cards.map((card, i) => {
            const Icon = card.icon;
            const isRight = i % 2 === 0;
            const isTop = i < 2;
            return (
              <Pressable
                key={card.key}
                onPress={() => router.push(card.route as any)}
                className={`w-1/2 p-3 ${isRight ? "border-r border-white-6" : ""} ${isTop ? "border-b border-white-6" : ""}`}
              >
                <View className="flex-row items-center justify-between mb-1">
                  <Icon size={14} color={COLORS.sageDark} />
                  <Text className="text-sm font-inter-bold" style={{ color: card.hintColor }}>
                    {card.hint}
                  </Text>
                </View>
                <Text className="text-[11px] font-inter-semibold text-foreground">
                  {card.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </MCardTight>
    </MobileZone>
  );
}
