import { useCallback, useMemo, useState } from "react";
import { Pressable, Text, View, ScrollView, RefreshControl } from "react-native";
import { useFocusEffect } from "expo-router";
import { ChevronDown, ChevronUp } from "lucide-react-native";
import type { CurrencyCode } from "@zeta/shared";
import { toLocalMonthString } from "../../lib/utils/date";
import { useSync } from "../../lib/sync/hooks";
import {
  getOccurrencesForMonth,
  getRecurringSummary,
  confirmOccurrence,
  skipOccurrence,
  type OccurrenceWithTemplate,
} from "../../lib/repositories/recurring";
import { getPreferredCurrency } from "../../lib/profile";
import { COLORS } from "../../lib/constants/colors";
import { MOBILE_TAB_BAR_CLEARANCE, SECTION_EYEBROW_CLASS } from "../../lib/constants/styles";
import { MobileHeader } from "../ui/MobileHeader";
import { MonthSelector } from "../common/MonthSelector";
import { MCard } from "../ui/MCard";
import { RecurringSummaryCard } from "./RecurringSummaryCard";
import { OccurrenceRow } from "./OccurrenceRow";

interface RecurringSummary {
  total_expected: number;
  pending_count: number;
  paid_count: number;
  skipped_count: number;
}

const EMPTY_SUMMARY: RecurringSummary = {
  total_expected: 0,
  pending_count: 0,
  paid_count: 0,
  skipped_count: 0,
};

export function RecurrentesRoot() {
  const { sync } = useSync();

  const [refreshing, setRefreshing] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(
    () => toLocalMonthString()
  );
  const [occurrences, setOccurrences] = useState<OccurrenceWithTemplate[]>([]);
  const [summary, setSummary] = useState<RecurringSummary>(EMPTY_SUMMARY);
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [currency, setCurrency] = useState<CurrencyCode>("COP");

  const loadData = useCallback(async () => {
    try {
      const [occ, sum, preferredCurrency] = await Promise.all([
        getOccurrencesForMonth(currentMonth),
        getRecurringSummary(currentMonth),
        getPreferredCurrency(),
      ]);
      setOccurrences(occ);
      setSummary(sum);
      setCurrency(preferredCurrency);
    } catch (error) {
      console.error("Failed to load recurrentes data:", error);
    }
  }, [currentMonth]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await sync();
      await loadData();
    } finally {
      setRefreshing(false);
    }
  }, [sync, loadData]);

  const handleConfirm = useCallback(
    async (occurrenceId: string) => {
      try {
        await confirmOccurrence(occurrenceId);
        await loadData();
      } catch (error) {
        console.error("Failed to confirm occurrence:", error);
      }
    },
    [loadData]
  );

  const handleSkip = useCallback(
    async (occurrenceId: string) => {
      try {
        await skipOccurrence(occurrenceId);
        await loadData();
      } catch (error) {
        console.error("Failed to skip occurrence:", error);
      }
    },
    [loadData]
  );

  const { pending, completed } = useMemo(() => {
    const p: OccurrenceWithTemplate[] = [];
    const c: OccurrenceWithTemplate[] = [];
    for (const occ of occurrences) {
      if (occ.status === "pending") {
        p.push(occ);
      } else {
        c.push(occ);
      }
    }
    return { pending: p, completed: c };
  }, [occurrences]);

  return (
    <View className="flex-1 bg-background">
      <MobileHeader variant="sub" title="Recurrentes" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: MOBILE_TAB_BAR_CLEARANCE }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.brass}
          />
        }
      >
        {/* Month navigation */}
        <View className="items-center">
          <MonthSelector month={currentMonth} onChange={setCurrentMonth} />
        </View>

        {/* Summary hero */}
        <RecurringSummaryCard
          totalExpected={summary.total_expected}
          pendingCount={summary.pending_count}
          paidCount={summary.paid_count}
          skippedCount={summary.skipped_count}
          currency={currency}
        />

        {/* Pending section */}
        <View className="mt-2">
          <Text className={`${SECTION_EYEBROW_CLASS} mb-2 px-1`}>
            Pendientes
          </Text>
          {pending.length === 0 ? (
            <MCard>
              <Text className="text-sm font-inter text-muted-foreground text-center py-2">
                No hay pagos pendientes este mes
              </Text>
            </MCard>
          ) : (
            <MCard className="p-0 overflow-hidden">
              {pending.map((occ, index) => (
                <View
                  key={occ.id}
                  className={
                    index < pending.length - 1
                      ? "border-b border-white-6"
                      : ""
                  }
                >
                  <OccurrenceRow
                    occurrence={occ}
                    onConfirm={handleConfirm}
                    onSkip={handleSkip}
                  />
                </View>
              ))}
            </MCard>
          )}
        </View>

        {/* Completed section — collapsible */}
        {completed.length > 0 && (
          <View className="mt-2">
            <Pressable
              onPress={() => setCompletedExpanded((prev) => !prev)}
              className="flex-row items-center justify-between mb-2 px-1"
            >
              <Text className={SECTION_EYEBROW_CLASS}>
                Completados ({completed.length})
              </Text>
              {completedExpanded ? (
                <ChevronUp size={14} color={COLORS.sageDark} />
              ) : (
                <ChevronDown size={14} color={COLORS.sageDark} />
              )}
            </Pressable>

            {completedExpanded && (
              <MCard className="p-0 overflow-hidden">
                {completed.map((occ, index) => (
                  <View
                    key={occ.id}
                    className={
                      index < completed.length - 1
                        ? "border-b border-white-6"
                        : ""
                    }
                  >
                    <OccurrenceRow
                      occurrence={occ}
                      onConfirm={handleConfirm}
                      onSkip={handleSkip}
                    />
                  </View>
                ))}
              </MCard>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
