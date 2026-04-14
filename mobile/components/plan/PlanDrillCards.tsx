import { View } from "react-native";
import { useRouter } from "expo-router";
import { PiggyBank, Repeat, Heart } from "lucide-react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { HubEntry } from "../ui/HubEntry";
import { MobileZone } from "../ui/MobileZone";

interface PlanDrillCardsProps {
  budgetSpent: number;
  budgetTarget: number;
  recurringCount: number;
  currency: CurrencyCode;
}

export function PlanDrillCards({
  budgetSpent,
  budgetTarget,
  recurringCount,
  currency,
}: PlanDrillCardsProps) {
  const router = useRouter();
  const budgetPct = budgetTarget > 0 ? Math.round((budgetSpent / budgetTarget) * 100) : 0;

  return (
    <MobileZone eyebrow="EXPLORAR">
      <View className="gap-1.5">
        <HubEntry
          icon={PiggyBank}
          title="Presupuesto"
          hint={budgetTarget > 0 ? `${budgetPct}% usado · ${formatCurrency(budgetSpent, currency)} de ${formatCurrency(budgetTarget, currency)}` : "Sin presupuesto configurado"}
          onPress={() => router.push("/(tabs)/budgets" as any)}
        />
        <HubEntry
          icon={Repeat}
          title="Recurrentes"
          hint={`${recurringCount} obligaciones activas`}
          onPress={() => router.push("/recurrentes" as any)}
        />
        <HubEntry
          icon={Heart}
          title="Deseos"
          hint="Lista de deseos financieros"
          onPress={() => router.push("/deseos" as any)}
        />
      </View>
    </MobileZone>
  );
}
