import { memo, useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { useRouter, type Href } from "expo-router";
import { Wallet, CalendarCheck, RotateCw } from "lucide-react-native";
import type { LucideIcon } from "lucide-react-native";
import { PANEL_INSET_CLASS, SECTION_EYEBROW_CLASS } from "../../lib/constants/styles";
import { COLORS } from "../../lib/constants/colors";

interface PlanToolsChipsProps {
  budgetOverLimit: number;
  budgetPct: number;
  periodHasActive: boolean;
  periodPercentAssigned: number;
  recurringUpcoming: number;
  recurringOverdue: number;
}

interface ToolDef {
  key: string;
  label: string;
  icon: LucideIcon;
  route: Href;
  status: React.ReactNode;
}

/**
 * Render a status line where alert words are highlighted in brass-hot
 * and the rest stays muted. Avoids aggressive red/yellow surfaces.
 */
function Status({ parts }: { parts: Array<{ text: string; emphasis?: boolean }> }) {
  return (
    <Text className="text-center text-[11px] font-inter text-muted-foreground leading-4">
      {parts.map((p, i) => (
        <Text
          key={i}
          className={p.emphasis ? "font-inter-semibold text-z-brass-hot" : ""}
        >
          {p.text}
        </Text>
      ))}
    </Text>
  );
}

function PlanToolsChipsBase({
  budgetOverLimit,
  budgetPct,
  periodHasActive,
  periodPercentAssigned,
  recurringUpcoming,
  recurringOverdue,
}: PlanToolsChipsProps) {
  const router = useRouter();

  const tools = useMemo<ToolDef[]>(() => [
    {
      key: "presupuesto",
      label: "Presupuesto",
      icon: Wallet,
      route: "/(tabs)/budgets" as Href,
      status:
        budgetOverLimit > 0 ? (
          <Status parts={[{ text: `${budgetOverLimit} sobre límite`, emphasis: true }]} />
        ) : (
          <Status parts={[{ text: `${budgetPct}% del mes` }]} />
        ),
    },
    {
      key: "periodo",
      label: "Periodo",
      icon: CalendarCheck,
      route: "/periodo" as Href,
      status: periodHasActive ? (
        <Status parts={[{ text: `${periodPercentAssigned}% asignado` }]} />
      ) : (
        <Status parts={[{ text: "Sin periodo activo" }]} />
      ),
    },
    {
      key: "recurrentes",
      label: "Recurrentes",
      icon: RotateCw,
      route: "/recurrentes" as Href,
      status:
        recurringOverdue > 0 ? (
          <Status
            parts={[
              { text: `${recurringUpcoming} próximos · ` },
              { text: `${recurringOverdue} vencida${recurringOverdue === 1 ? "" : "s"}`, emphasis: true },
            ]}
          />
        ) : (
          <Status parts={[{ text: `${recurringUpcoming} próximos` }]} />
        ),
    },
  ], [budgetOverLimit, budgetPct, periodHasActive, periodPercentAssigned, recurringUpcoming, recurringOverdue]);

  return (
    <View className="flex-row gap-2">
      {tools.map((tool) => {
        const Icon = tool.icon;
        return (
          <Pressable
            key={tool.key}
            onPress={() => router.push(tool.route)}
            accessibilityRole="button"
            accessibilityLabel={tool.label}
            className={`${PANEL_INSET_CLASS} flex-1 items-center justify-between px-2 py-3.5`}
            style={{ minHeight: 120 }}
          >
            <Text className={`${SECTION_EYEBROW_CLASS} text-center`}>
              {tool.label}
            </Text>
            <Icon size={26} color={COLORS.brass} strokeWidth={1.6} />
            {tool.status}
          </Pressable>
        );
      })}
    </View>
  );
}

export const PlanToolsChips = memo(PlanToolsChipsBase);
