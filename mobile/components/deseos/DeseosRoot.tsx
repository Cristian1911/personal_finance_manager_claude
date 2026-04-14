import { useCallback, useState } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable, TextInput } from "react-native";
import { useFocusEffect } from "expo-router";
import { Heart, Plus, ShoppingBag, Sparkles, Target } from "lucide-react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { useSync } from "../../lib/sync/hooks";
import {
  getActiveWishlistItems,
  getWishlistSummary,
  createWishlistItem,
  type WishlistItemWithCategory,
} from "../../lib/repositories/wishlist";
import { useAuth } from "../../lib/auth";
import { COLORS } from "../../lib/constants/colors";
import { MobileHeader } from "../ui/MobileHeader";
import { MCard, MCardGrid, MCardGridCell } from "../ui/MCard";
import { MobileZone } from "../ui/MobileZone";
import {
  SECTION_EYEBROW_CLASS,
  BRASS_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
} from "../../lib/constants/styles";

interface DeseosState {
  items: WishlistItemWithCategory[];
  totalAmount: number;
}

const INITIAL: DeseosState = {
  items: [], totalAmount: 0,
};

export function DeseosRoot() {
  const { sync } = useSync();
  const { session } = useAuth();
  const currency: CurrencyCode = "COP";

  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<DeseosState>(INITIAL);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formAmount, setFormAmount] = useState("");

  const loadData = useCallback(async () => {
    try {
      const [items, summary] = await Promise.all([
        getActiveWishlistItems(),
        getWishlistSummary(),
      ]);
      setData({
        items,
        totalAmount: summary.total_amount,
      });
    } catch (error) {
      console.error("Failed to load wishlist:", error);
    }
  }, []);

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

  const handleCreate = useCallback(async () => {
    const amount = parseFloat(formAmount);
    if (!formName.trim() || isNaN(amount) || amount <= 0) return;
    if (!session?.user?.id) return;

    await createWishlistItem({
      user_id: session.user.id,
      name: formName.trim(),
      amount,
    });

    setFormName("");
    setFormAmount("");
    setShowForm(false);
    await loadData();
  }, [formName, formAmount, session, loadData]);

  const totalItems = data.items.length;

  return (
    <View className="flex-1 bg-background">
      <MobileHeader
        variant="sub"
        title="Deseos"
        action={
          <Pressable
            onPress={() => setShowForm(!showForm)}
            className="h-7 w-7 items-center justify-center rounded-full bg-z-brass"
          >
            <Plus size={14} color={COLORS.ink} strokeWidth={2.5} />
          </Pressable>
        }
      />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 100 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={COLORS.brass} />
        }
      >
        {/* Summary */}
        {totalItems > 0 && (
          <MCardGrid>
            <MCardGridCell borderRight>
              <Text className="text-[18px] font-inter-bold text-foreground">
                {totalItems}
              </Text>
              <Text className="text-[9px] font-inter text-muted-foreground mt-0.5">
                Deseos activos
              </Text>
            </MCardGridCell>
            <MCardGridCell>
              <Text className="text-[18px] font-inter-bold text-z-alert">
                {formatCurrency(data.totalAmount, currency)}
              </Text>
              <Text className="text-[9px] font-inter text-muted-foreground mt-0.5">
                Total deseado
              </Text>
            </MCardGridCell>
          </MCardGrid>
        )}

        {/* Quick add form */}
        {showForm && (
          <MCard>
            <Text className={`mb-2 ${SECTION_EYEBROW_CLASS}`}>NUEVO DESEO</Text>
            <TextInput
              placeholder="¿Qué quieres?"
              placeholderTextColor={COLORS.sageDark}
              value={formName}
              onChangeText={setFormName}
              className="rounded-lg border border-white-6 bg-black-10 px-3 py-2.5 text-[14px] font-inter text-foreground mb-2"
            />
            <TextInput
              placeholder="Precio estimado"
              placeholderTextColor={COLORS.sageDark}
              value={formAmount}
              onChangeText={setFormAmount}
              keyboardType="numeric"
              className="rounded-lg border border-white-6 bg-black-10 px-3 py-2.5 text-[14px] font-inter text-foreground mb-3"
            />
            <View className="flex-row gap-2">
              <Pressable
                onPress={handleCreate}
                className={`${BRASS_BUTTON_CLASS} flex-1 rounded-lg py-2.5 items-center`}
              >
                <Text className="text-[13px] font-inter-semibold text-z-ink">Agregar</Text>
              </Pressable>
              <Pressable
                onPress={() => setShowForm(false)}
                className={`${GHOST_BUTTON_CLASS} rounded-lg py-2.5 px-4 items-center`}
              >
                <Text className="text-[13px] font-inter-semibold text-z-sage-light">Cancelar</Text>
              </Pressable>
            </View>
          </MCard>
        )}

        {/* Wishlist items */}
        {data.items.length === 0 && !showForm ? (
          <View className="items-center justify-center py-16">
            <Heart size={48} color={COLORS.sageDark} />
            <Text className="text-[15px] font-inter-semibold text-foreground mt-3">
              Sin deseos todavía
            </Text>
            <Text className="text-[12px] font-inter text-muted-foreground text-center mt-1 max-w-[240px]">
              Agrega cosas que quieres y Zeta te ayuda a evaluar si es buen momento para comprarlas
            </Text>
          </View>
        ) : (
          <MobileZone eyebrow="MIS DESEOS">
            <View className="gap-1.5">
              {data.items.map((item) => (
                <WishlistRow key={item.id} item={item} currency={currency} />
              ))}
            </View>
          </MobileZone>
        )}
      </ScrollView>
    </View>
  );
}

function WishlistRow({
  item,
  currency,
}: {
  item: WishlistItemWithCategory;
  currency: CurrencyCode;
}) {
  const STATUS_MAP: Record<string, { icon: typeof Target; color: string }> = {
    WANT: { icon: ShoppingBag, color: COLORS.alert },
    SAVING: { icon: Sparkles, color: COLORS.brass },
    READY: { icon: Target, color: COLORS.income },
    BOUGHT: { icon: Heart, color: COLORS.income },
  };
  const { icon: StatusIcon, color: statusColor } = STATUS_MAP[item.status] ?? {
    icon: Heart,
    color: COLORS.alert,
  };

  return (
    <MCard>
      <View className="flex-row items-center gap-3">
        <View
          className="h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${statusColor}20` }}
        >
          <StatusIcon size={16} color={statusColor} />
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-[14px] font-inter-semibold text-foreground" numberOfLines={1}>
            {item.name}
          </Text>
          <View className="flex-row items-center gap-2 mt-0.5">
            <Text className="text-[12px] font-inter-medium text-foreground">
              {formatCurrency(item.amount, currency)}
            </Text>
            {item.category_name && (
              <Text className="text-[10px] font-inter text-muted-foreground">
                · {item.category_name}
              </Text>
            )}
          </View>
        </View>
        {item.last_score != null && (
          <View className="items-center">
            <Text className="text-[16px] font-inter-bold text-z-brass">
              {Math.round(item.last_score)}
            </Text>
            <Text className="text-[8px] font-inter text-muted-foreground">puntos</Text>
          </View>
        )}
      </View>
    </MCard>
  );
}
