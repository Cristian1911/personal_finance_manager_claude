import { memo, useEffect, useRef, useState } from "react";
import { View, Text, Pressable } from "react-native";
import {
  Banknote,
  Link2,
  MoreHorizontal,
  Pencil,
  Repeat2,
  Tag,
  UserRound,
} from "lucide-react-native";
import { formatCurrency, formatDate, type CurrencyCode } from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";
import { SECTION_EYEBROW_CLASS } from "../../lib/constants/styles";
import { AnimatedAccordion } from "../ui/AnimatedAccordion";
import { CategoryIcon } from "../ui/CategoryIcon";
import { MobileSheet } from "../ui/MobileSheet";
import type { TransactionListRow } from "../../lib/repositories/transactions";

/** rgba tint of a hex category/account color (mirrors webapp zone-colors). */
function tint(hex: string, alpha: number): string {
  const m = hex.match(/^#([0-9a-f]{6})/i);
  if (!m) return `rgba(147,140,126,${alpha})`;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** Compact account label: "····4398", "VISA ····7022", or a truncated name.
 *  Mirrors webapp `accountTail` in transaction-quick-actions.tsx. */
function accountTail(name: string): string {
  const match = name.match(/(\d{4})\s*$/);
  if (!match) return name.length > 14 ? `${name.slice(0, 13)}…` : name;
  return `${/visa/i.test(name) ? "VISA " : ""}····${match[1]}`;
}

const SAGE_TILE_BG = tint("#768053", 0.14);

interface MovimientosTransactionRowProps {
  transaction: TransactionListRow;
  /** True if the tx's account has at least one pending recurring occurrence
   *  (direct or via transfer_source_account_id) — gates the Vincular tile. */
  canLink?: boolean;
  onRequestCategoryPicker: (txId: string) => void;
  onRequestDestinatarioPicker?: (txId: string) => void;
  onRequestTagPicker?: (txId: string) => void;
  onRequestVincular?: (txId: string) => void;
  /** Navigate to the transaction detail — lifted so the memoized row doesn't
   *  subscribe to the router context itself. */
  onNavigateToDetail?: (txId: string) => void;
}

/**
 * Transaction card — mirror of the webapp Movimientos card (Claude Design
 * "Movimientos - Prototipo"): category icon tile + name + category pill on the
 * left, amount + account pill on the right. Expanding highlights the card
 * ("tono") and reveals the fixed trio Categoría · Destinatario · Más; the Más
 * sheet holds Etiquetas, Vincular and Ver/editar in stable positions.
 */
function MovimientosTransactionRowBase({
  transaction: tx,
  canLink,
  onRequestCategoryPicker,
  onRequestDestinatarioPicker,
  onRequestTagPicker,
  onRequestVincular,
  onNavigateToDetail,
}: MovimientosTransactionRowProps) {
  const [expanded, setExpanded] = useState(false);
  // moreOpen drives the Modal's visible prop (so the close slide plays);
  // sheetMounted keeps it in the tree until that exit animation finishes.
  const [moreOpen, setMoreOpen] = useState(false);
  const [sheetMounted, setSheetMounted] = useState(false);
  const unmountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    if (unmountTimer.current) clearTimeout(unmountTimer.current);
  }, []);

  function openSheet() {
    if (unmountTimer.current) clearTimeout(unmountTimer.current);
    setSheetMounted(true);
    setMoreOpen(true);
  }

  function closeSheet() {
    setMoreOpen(false);
    unmountTimer.current = setTimeout(() => setSheetMounted(false), 300);
  }

  const description = tx.merchant_name ?? tx.description ?? "Sin descripción";
  const isInflow = tx.direction === "INFLOW";
  const isExcluded = Boolean(tx.is_excluded);
  const categoryName = tx.category_name_es ?? tx.category_name;
  const catColor = tx.category_color;
  const isLinkedRecurring = Boolean(tx.recurrence_group_id);

  const iconTile = (
    <View
      className="h-[38px] w-[38px] items-center justify-center rounded-xl"
      style={{ backgroundColor: catColor ? tint(catColor, 0.15) : SAGE_TILE_BG }}
    >
      {tx.category_icon ? (
        <CategoryIcon icon={tx.category_icon} size={17} color={catColor ?? COLORS.sageLight} />
      ) : (
        <Banknote size={17} color={COLORS.sageLight} />
      )}
    </View>
  );

  const amountText = (
    <Text
      className={`text-[15px] font-inter-medium tabular-nums ${
        isInflow ? "text-z-income" : "text-z-expense"
      } ${isExcluded ? "line-through" : ""}`}
    >
      {isInflow ? "+" : "−"}
      {formatCurrency(Math.abs(tx.amount), tx.currency_code as CurrencyCode)}
    </Text>
  );

  return (
    <View
      className={`mb-2 rounded-2xl border px-3.5 py-3 ${
        expanded ? "border-white-15 bg-z-surface-3" : "border-white-6 bg-z-surface-2-80"
      }`}
    >
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        className={`flex-row items-center gap-3 ${isExcluded ? "opacity-40" : ""}`}
      >
        {iconTile}

        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1.5">
            {isLinkedRecurring && <Repeat2 size={13} color={COLORS.brass} />}
            <Text
              className="shrink text-[15px] font-inter-medium text-foreground"
              numberOfLines={1}
            >
              {description}
            </Text>
          </View>
          <View className="mt-1 flex-row">
            <Text
              numberOfLines={1}
              className="shrink rounded-full border px-2 py-px text-[11px] font-inter-medium"
              style={
                catColor
                  ? {
                      backgroundColor: tint(catColor, 0.15),
                      borderColor: tint(catColor, 0.2),
                      color: catColor,
                    }
                  : {
                      backgroundColor: SAGE_TILE_BG,
                      borderColor: tint("#768053", 0.2),
                      color: COLORS.sageLight,
                    }
              }
            >
              {categoryName ?? "Sin categoría"}
            </Text>
          </View>
        </View>

        <View className="shrink-0 items-center gap-1">
          {amountText}
          <View className="flex-row items-center gap-1 rounded-full bg-white-5 px-2 py-0.5">
            {tx.account_color && (
              <View
                className="h-[5px] w-[5px] rounded-full"
                style={{ backgroundColor: tx.account_color }}
              />
            )}
            <Text className="text-[10px] font-inter text-z-sage-dark">
              {tx.account_name ? accountTail(tx.account_name) : "Cuenta"}
            </Text>
          </View>
        </View>
      </Pressable>

      {/* Trio — Categoría · Destinatario · Más (fixed positions). Children
          gated by `expanded` so collapsed rows don't mount 3 Pressables each. */}
      <AnimatedAccordion expanded={expanded} estimatedHeight={48}>
        {expanded && (
        <View className="flex-row gap-2 pt-3">
          <Pressable
            onPress={() => onRequestCategoryPicker(tx.id)}
            accessibilityRole="button"
            accessibilityLabel="Cambiar categoría"
            className="h-[34px] flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-white-8 bg-black-10 active:bg-white-5"
          >
            <Tag size={14} color={COLORS.sageLight} />
            <Text className="text-xs font-inter-medium text-z-sage-light">Categoría</Text>
          </Pressable>
          <Pressable
            onPress={() => onRequestDestinatarioPicker?.(tx.id)}
            accessibilityRole="button"
            accessibilityLabel={
              tx.destinatario_name
                ? `Cambiar destinatario ${tx.destinatario_name}`
                : "Asignar destinatario"
            }
            className="h-[34px] flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-white-8 bg-black-10 active:bg-white-5"
          >
            <UserRound size={14} color={COLORS.sageLight} />
            <Text className="shrink text-xs font-inter-medium text-z-sage-light" numberOfLines={1}>
              {tx.destinatario_name ?? "Destinatario"}
            </Text>
          </Pressable>
          <Pressable
            onPress={openSheet}
            accessibilityRole="button"
            accessibilityLabel="Más acciones"
            className="h-[34px] flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border border-white-8 bg-black-10 active:bg-white-5"
          >
            <MoreHorizontal size={14} color={COLORS.sageLight} />
            <Text className="text-xs font-inter-medium text-z-sage-light">Más</Text>
          </Pressable>
        </View>
        )}
      </AnimatedAccordion>

      {/* "Más" sheet — mounted only while open (one Modal per open row, not
          per row); unmount is delayed past close so the exit slide plays. */}
      {sheetMounted && (
        <MobileSheet visible={moreOpen} onClose={closeSheet} maxHeightClass="max-h-[70%]">
          <View className="px-5 pb-8">
            {/* Transaction header */}
            <View className="flex-row items-center gap-3 border-b border-white-6 pb-3.5">
              {iconTile}
              <View className="min-w-0 flex-1">
                <Text className="text-[15px] font-inter-medium text-foreground" numberOfLines={1}>
                  {description}
                </Text>
                <Text className="mt-0.5 text-[11.5px] font-inter capitalize text-z-sage-dark">
                  {[
                    formatDate(tx.transaction_date, "EEEE, dd MMM"),
                    tx.transaction_time ? tx.transaction_time.slice(0, 5) : null,
                    tx.account_name ? accountTail(tx.account_name) : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              {amountText}
            </View>

            {/* Acciones — fixed positions */}
            <Text className={`${SECTION_EYEBROW_CLASS} pb-2 pt-3.5`}>Acciones</Text>
            <View className="flex-row gap-2">
              <Pressable
                onPress={() => {
                  closeSheet();
                  onRequestTagPicker?.(tx.id);
                }}
                accessibilityRole="button"
                accessibilityLabel="Editar etiquetas"
                className="h-[84px] flex-1 items-center justify-center gap-1.5 rounded-2xl border border-white-6 bg-black-10 px-3.5 active:bg-white-5"
              >
                <Tag size={18} color={COLORS.brass} />
                <Text className="text-center text-[13px] font-inter text-z-sage-light">
                  Etiquetas
                </Text>
              </Pressable>

              {isLinkedRecurring ? (
                <View className="h-[84px] flex-1 items-center justify-center gap-1.5 rounded-2xl border border-z-brass-20 bg-z-brass-8 px-3.5">
                  <Repeat2 size={18} color={COLORS.brass} />
                  <Text className="text-center text-[13px] font-inter text-z-brass">
                    Vinculada a recurrente
                  </Text>
                </View>
              ) : (
                <Pressable
                  onPress={() => {
                    closeSheet();
                    onRequestVincular?.(tx.id);
                  }}
                  disabled={!canLink || !onRequestVincular}
                  accessibilityRole="button"
                  accessibilityLabel="Vincular a recurrente"
                  className={`h-[84px] flex-1 items-center justify-center gap-1.5 rounded-2xl border border-white-6 bg-black-10 px-3.5 active:bg-white-5 ${
                    !canLink || !onRequestVincular ? "opacity-40" : ""
                  }`}
                >
                  <Link2 size={18} color={COLORS.brass} />
                  <Text className="text-center text-[13px] font-inter text-z-sage-light">
                    Vincular a recurrente
                  </Text>
                </Pressable>
              )}
            </View>

            <Pressable
              onPress={() => {
                closeSheet();
                onNavigateToDetail?.(tx.id);
              }}
              accessibilityRole="button"
              accessibilityLabel="Ver o editar detalle"
              className="mt-3.5 h-10 flex-row items-center justify-center gap-2 rounded-lg border border-white-8 bg-black-10 active:bg-white-5"
            >
              <Pencil size={15} color={COLORS.sageLight} />
              <Text className="text-sm font-inter-medium text-z-sage-light">
                Ver / editar detalle
              </Text>
            </Pressable>
          </View>
        </MobileSheet>
      )}
    </View>
  );
}

export const MovimientosTransactionRow = memo(MovimientosTransactionRowBase);
