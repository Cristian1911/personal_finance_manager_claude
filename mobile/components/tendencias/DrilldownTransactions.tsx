import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { ArrowUpRight } from "lucide-react-native";
import { formatCurrency } from "@zeta/shared";
import { COLORS } from "../../lib/constants/colors";
import {
  getDrilldownTransactions,
  type DrilldownTransaction,
} from "../../lib/repositories/analytics";

const CURRENCY = "COP";
const TABULAR = { fontVariant: ["tabular-nums" as const] };
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
/** "2026-06-15" → "15 jun". TZ-safe string slice. */
function shortDate(iso: string): string {
  const parts = iso.split("-");
  return `${Number(parts[2])} ${MESES[Number(parts[1]) - 1] ?? ""}`;
}

/** Read-only OUTFLOW transactions behind one category / destinatario in the
 * active window. Self-fetches on mount — lazy-mount it inside the accordion the
 * first time a row opens. Mirrors the webapp DrilldownTransactions. */
export function DrilldownTransactions({
  categoryId,
  destinatarioId,
  dateFrom,
  dateTo,
}: {
  categoryId?: string;
  destinatarioId?: string;
  dateFrom: string;
  dateTo: string;
}) {
  const [rows, setRows] = useState<DrilldownTransaction[] | null>(null);

  useEffect(() => {
    let active = true;
    setRows(null);
    // 25 is an exploratory peek, not a full ledger — keeps the inline mount
    // (and the accordion's estimatedHeight) bounded. Dense histories get a
    // "ver todos" deep-link later (BACKLOG).
    getDrilldownTransactions({ categoryId, destinatarioId, dateFrom, dateTo, limit: 25 })
      .then((r) => {
        if (active) setRows(r);
      })
      .catch(() => {
        if (active) setRows([]);
      });
    return () => {
      active = false;
    };
  }, [categoryId, destinatarioId, dateFrom, dateTo]);

  if (rows === null) {
    return (
      <View className="py-3">
        <ActivityIndicator
          color={COLORS.brass}
          accessibilityLabel="Cargando movimientos"
        />
      </View>
    );
  }
  if (rows.length === 0) {
    return (
      <Text className="py-3 text-xs font-inter text-z-sage-dark">
        Sin movimientos en el periodo.
      </Text>
    );
  }
  return (
    <View className="pb-1">
      {rows.map((t) => (
        <View key={t.id} className="flex-row items-center gap-2.5 py-2">
          <ArrowUpRight size={14} color={COLORS.expense} accessible={false} />
          <View className="min-w-0 flex-1">
            <Text
              numberOfLines={1}
              className="text-xs font-inter-medium text-foreground"
            >
              {t.description}
            </Text>
            <Text className="text-[10px] font-inter text-z-sage-dark">
              {shortDate(t.date)} · {t.accountLabel}
            </Text>
          </View>
          <Text
            className="text-xs font-inter-semibold text-foreground"
            style={TABULAR}
          >
            {formatCurrency(t.amount, CURRENCY)}
          </Text>
        </View>
      ))}
    </View>
  );
}
