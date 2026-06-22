import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, ChevronRight, FileUp, Tag } from "lucide-react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { formatCurrency, formatDate, type CurrencyCode } from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";
import { MobileZone } from "../ui/MobileZone";
import { AnimatedAccordion } from "../ui/AnimatedAccordion";
import {
  BRASS_GHOST_BUTTON_CLASS,
  PANEL_INSET_CLASS,
  SECTION_EYEBROW_CLASS,
} from "../../lib/constants/styles";
import type { UncategorizedSampleRow } from "../../lib/repositories/transactions";
import type { CategoryRow } from "../../lib/repositories/categories";
import { getPendingEmailTransactionsCount } from "../../lib/repositories/pending-email";
import { EmailImportPanel } from "./EmailImportPanel";

const MAX_ITEMS = 5;

interface MovimientosHerramientasProps {
  uncategorizedTransactions: UncategorizedSampleRow[];
  uncategorizedCount: number;
  categories: CategoryRow[];
  activeTool: "categorizar" | "importar" | null;
  onToggleTool: (tool: "categorizar" | "importar") => void;
  /** Delegate picker opening to the Root (which owns the single hoisted CategoryPickerSheet). */
  onRequestCategoryPicker: (transactionId: string) => void;
  /** Re-read the Movimientos feed after a tool mutation (email-queue import). */
  onDataChanged?: () => void;
}

function MovimientosHerramientasBase({
  uncategorizedTransactions,
  uncategorizedCount,
  categories,
  activeTool,
  onToggleTool,
  onRequestCategoryPicker,
  onDataChanged,
}: MovimientosHerramientasProps) {
  const router = useRouter();

  void categories;

  const [emailCount, setEmailCount] = useState(0);
  const [emailPanelHeight, setEmailPanelHeight] = useState(200);

  const refreshEmailCount = useCallback(() => {
    getPendingEmailTransactionsCount()
      .then(setEmailCount)
      .catch(() => {});
  }, []);

  // Wrap so the effect returns undefined — useFocusEffect treats a non-function
  // return (refreshEmailCount returns a Promise) as a cleanup and dev-errors.
  useFocusEffect(
    useCallback(() => {
      refreshEmailCount();
    }, [refreshEmailCount])
  );

  const visibleUncategorized = useMemo(
    () => uncategorizedTransactions.slice(0, MAX_ITEMS),
    [uncategorizedTransactions]
  );

  // Retain last-active tool during the close animation so the accordion fades
  // real content instead of clipping an empty box.
  // See feedback_expand_animation_keep_content_mounted.md.
  const [lastTool, setLastTool] = useState<typeof activeTool>(activeTool);
  const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (clearTimer.current) {
      clearTimeout(clearTimer.current);
      clearTimer.current = null;
    }
    if (activeTool) {
      setLastTool(activeTool);
    } else {
      clearTimer.current = setTimeout(() => setLastTool(null), 260);
    }
    return () => {
      if (clearTimer.current) {
        clearTimeout(clearTimer.current);
        clearTimer.current = null;
      }
    };
  }, [activeTool]);

  const renderedTool = activeTool ?? lastTool;

  return (
    <MobileZone eyebrow="HERRAMIENTAS">
      <View className="flex-row gap-1.5">
        <Pressable
          onPress={() => onToggleTool("categorizar")}
          className={`flex-1 rounded-2xl border p-2.5 items-center ${
            activeTool === "categorizar"
              ? "border-z-brass-30 bg-z-brass-10"
              : "border-z-brass-20 bg-z-brass-6"
          }`}
        >
          <Text className="text-[22px] font-inter-bold leading-tight text-z-brass">
            {uncategorizedCount}
          </Text>
          <Text className="mt-0.5 text-[10px] font-inter-semibold text-muted-foreground">
            Categorizar
          </Text>
          {uncategorizedCount > 0 ? (
            <View className="mt-1 flex-row items-center gap-1">
              <View className="h-1.5 w-1.5 rounded-full bg-z-debt" />
              <Text className="text-[9px] font-inter text-z-debt">
                {uncategorizedCount} por resolver
              </Text>
            </View>
          ) : (
            <Text className="mt-1 text-[9px] font-inter text-muted-foreground">
              Todo en orden
            </Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => onToggleTool("importar")}
          className={`flex-1 rounded-2xl border p-2.5 items-center ${
            activeTool === "importar"
              ? "border-z-sage-30 bg-z-sage-20"
              : "border-z-sage-20 bg-z-sage-10"
          }`}
        >
          {emailCount > 0 ? (
            <>
              <Text className="text-[22px] font-inter-bold leading-tight text-z-sage-light">
                {emailCount}
              </Text>
              <Text className="mt-0.5 text-[10px] font-inter-semibold text-muted-foreground">
                Importar
              </Text>
              <Text className="mt-1 text-[9px] font-inter text-z-sage-light">
                {emailCount} {emailCount === 1 ? "correo" : "correos"}
              </Text>
            </>
          ) : (
            <>
              <View className="h-6 w-6 items-center justify-center rounded-lg bg-z-sage-20">
                <FileUp size={14} color={COLORS.sageLight} />
              </View>
              <Text className="mt-1 text-[10px] font-inter-semibold text-muted-foreground">
                Importar
              </Text>
              <Text className="mt-1 text-[9px] font-inter text-z-sage-light">
                Subir PDF
              </Text>
            </>
          )}
        </Pressable>
      </View>

      <AnimatedAccordion
        expanded={activeTool !== null}
        estimatedHeight={renderedTool === "importar" ? emailPanelHeight + 24 : 260}
      >
        <View className={`mt-1.5 ${PANEL_INSET_CLASS} border-white-8 bg-black-20 p-3`}>
          {renderedTool === "categorizar" && (
            <CategorizarDetail
              items={visibleUncategorized}
              visibleCount={uncategorizedCount}
              onPick={onRequestCategoryPicker}
              onSeeAll={() => router.push("/categorizar" as any)}
            />
          )}
          {renderedTool === "importar" && (
            <EmailImportPanel
              onOpenImport={() => router.push("/(tabs)/import" as any)}
              onAfterChange={() => {
                refreshEmailCount();
                onDataChanged?.();
              }}
              onHeightChange={setEmailPanelHeight}
            />
          )}
        </View>
      </AnimatedAccordion>
    </MobileZone>
  );
}

/* ─── Categorizar detail ─────────────────────────────────────────────── */

function CategorizarDetail({
  items,
  visibleCount,
  onPick,
  onSeeAll,
}: {
  items: UncategorizedSampleRow[];
  visibleCount: number;
  onPick: (txId: string) => void;
  onSeeAll: () => void;
}) {
  if (visibleCount <= 0) {
    return (
      <View className="gap-1.5">
        <Text className={`${SECTION_EYEBROW_CLASS} text-z-brass`}>
          Transacciones sin categoría
        </Text>
        <Text className="text-xs font-inter text-z-sage-light">
          Todas las transacciones están categorizadas.
        </Text>
      </View>
    );
  }

  return (
    <View className="gap-2">
      <Text className={`${SECTION_EYEBROW_CLASS} text-z-brass`}>
        Transacciones sin categoría
      </Text>

      <View>
        {items.map((tx) => {
          const isInflow = tx.direction === "INFLOW";
          const label = tx.merchant_name ?? tx.description ?? "Sin descripción";
          return (
            <Pressable
              key={tx.id}
              onPress={() => onPick(tx.id)}
              className="flex-row items-center gap-2 rounded-lg px-1.5 py-1.5 active:bg-z-surface-2-5"
            >
              <View
                className={`h-5 w-5 items-center justify-center rounded-md ${isInflow ? "bg-z-income-10" : "bg-z-expense-12"}`}
              >
                {isInflow ? (
                  <ArrowDownLeft size={11} color={COLORS.income} />
                ) : (
                  <ArrowUpRight size={11} color={COLORS.expense} />
                )}
              </View>
              <View className="min-w-0 flex-1">
                <Text className="text-xs font-inter-medium text-foreground" numberOfLines={1}>
                  {label}
                </Text>
                <Text className="text-[10px] font-inter text-muted-foreground">
                  {formatDate(tx.transaction_date, "dd MMM")}
                </Text>
              </View>
              <Text className="text-xs font-inter-semibold text-foreground">
                {formatCurrency(tx.amount, tx.currency_code as CurrencyCode)}
              </Text>
              <View className={`${BRASS_GHOST_BUTTON_CLASS} ml-1 flex-row items-center gap-1 rounded-full px-2 py-0.5`}>
                <Tag size={9} color={COLORS.brass} />
                <Text className="text-[9px] font-inter-semibold text-z-brass">
                  Categoría
                </Text>
              </View>
              <ChevronRight size={12} color={COLORS.sageDark} />
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row items-center justify-between pt-1">
        <Text className="text-[10px] font-inter text-muted-foreground">
          Mostrando {items.length} de {visibleCount}
        </Text>
        <Pressable onPress={onSeeAll} className="flex-row items-center gap-1">
          <Text className="text-[11px] font-inter-semibold text-z-brass">
            Categorizar todas
          </Text>
          <ArrowRight size={11} color={COLORS.brass} />
        </Pressable>
      </View>
    </View>
  );
}

export const MovimientosHerramientas = memo(MovimientosHerramientasBase);
