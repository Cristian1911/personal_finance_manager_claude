import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  User,
  Mail,
  CreditCard,
  RefreshCw,
  Clock,
  LogOut,
  Wallet,
  Shield,
  Trash2,
} from "lucide-react-native";
import { formatRelativeDate, formatCurrency, type CurrencyCode } from "@venti5/shared";
import { useSync } from "../../lib/sync/hooks";
import { useAppStore } from "../../lib/store";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { clearDatabase, getDatabase } from "../../lib/db/database";
import { getAllAccounts } from "../../lib/repositories/accounts";

type AccountRow = {
  id: string;
  name: string;
  account_type: string;
  currency_code: string;
  current_balance: number;
  icon: string | null;
  color: string | null;
};

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-gray-500 font-inter-semibold text-xs uppercase px-4 pt-5 pb-2">
      {title}
    </Text>
  );
}

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  destructive = false,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const Wrapper = onPress ? Pressable : View;
  return (
    <Wrapper
      className="flex-row items-center px-4 py-3.5 bg-white active:bg-gray-50"
      {...(onPress ? { onPress } : {})}
    >
      <View className="mr-3">{icon}</View>
      <Text
        className={`flex-1 font-inter-medium text-sm ${
          destructive ? "text-red-500" : "text-gray-900"
        }`}
      >
        {label}
      </Text>
      {value && (
        <Text className="text-gray-500 font-inter text-sm">{value}</Text>
      )}
    </Wrapper>
  );
}

export default function SettingsScreen() {
  const { session } = useAuth();
  const { status, lastSynced, sync } = useSync();
  const { profile, clear } = useAppStore();
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [syncing, setSyncing] = useState(false);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const result = (await getAllAccounts()) as AccountRow[];
        setAccounts(result);
      })();
    }, [])
  );

  const handleClearSyncQueue = useCallback(() => {
    Alert.alert(
      "Limpiar cola de sincronizacion",
      "Se eliminaran las operaciones pendientes. Los datos locales no se afectan.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Limpiar",
          style: "destructive",
          onPress: async () => {
            try {
              const db = await getDatabase();
              await db.runAsync("DELETE FROM sync_queue WHERE synced_at IS NULL");
              Alert.alert("Listo", "Cola de sincronizacion limpiada.");
            } catch (error) {
              console.error("Clear sync queue error:", error);
            }
          },
        },
      ]
    );
  }, []);

  const handleSyncNow = useCallback(async () => {
    setSyncing(true);
    try {
      await sync();
    } finally {
      setSyncing(false);
    }
  }, [sync]);

  const handleSignOut = useCallback(() => {
    Alert.alert("Cerrar sesion", "Se eliminaran los datos locales.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesion",
        style: "destructive",
        onPress: async () => {
          try {
            await supabase.auth.signOut();
            await clearDatabase();
            clear();
          } catch (error) {
            console.error("Sign out error:", error);
          }
        },
      },
    ]);
  }, [clear]);

  const syncStatusLabel =
    status === "syncing" || syncing
      ? "Sincronizando..."
      : status === "error"
        ? "Error de sincronizacion"
        : "Sincronizado";

  const syncStatusIcon = status === "syncing" || syncing ? "..." : null;

  const accountTypeLabel = (type: string) => {
    switch (type) {
      case "CHECKING":
        return "Corriente";
      case "SAVINGS":
        return "Ahorros";
      case "CREDIT_CARD":
        return "T. Credito";
      case "LOAN":
        return "Prestamo";
      case "INVESTMENT":
        return "Inversion";
      default:
        return type;
    }
  };

  return (
    <ScrollView className="flex-1 bg-gray-50">
      {/* Profile section */}
      <SectionHeader title="Perfil" />
      <View className="bg-white">
        <SettingsRow
          icon={<User size={18} color="#6B7280" />}
          label="Nombre"
          value={profile?.full_name || session?.user?.user_metadata?.full_name || "---"}
        />
        <View className="h-px bg-gray-100 ml-12" />
        <SettingsRow
          icon={<Mail size={18} color="#6B7280" />}
          label="Email"
          value={session?.user?.email || "---"}
        />
        <View className="h-px bg-gray-100 ml-12" />
        <SettingsRow
          icon={<Shield size={18} color="#6B7280" />}
          label="Plan"
          value="Gratuito"
        />
      </View>

      {/* Sync section */}
      <SectionHeader title="Sincronizacion" />
      <View className="bg-white">
        <SettingsRow
          icon={
            <RefreshCw
              size={18}
              color={status === "error" ? "#EF4444" : "#6B7280"}
            />
          }
          label="Estado"
          value={syncStatusLabel}
        />
        <View className="h-px bg-gray-100 ml-12" />
        <SettingsRow
          icon={<Clock size={18} color="#6B7280" />}
          label="Ultima sincronizacion"
          value={lastSynced ? formatRelativeDate(lastSynced) : "Nunca"}
        />
        <View className="h-px bg-gray-100 ml-12" />
        <Pressable
          className="flex-row items-center px-4 py-3.5 bg-white active:bg-gray-50"
          onPress={handleSyncNow}
          disabled={syncing}
        >
          <RefreshCw size={18} color="#10B981" />
          <Text className="ml-3 text-primary font-inter-bold text-sm">
            {syncing ? "Sincronizando..." : "Sincronizar ahora"}
          </Text>
        </Pressable>
        <View className="h-px bg-gray-100 ml-12" />
        <Pressable
          className="flex-row items-center px-4 py-3.5 bg-white active:bg-gray-50"
          onPress={handleClearSyncQueue}
        >
          <Trash2 size={18} color="#EF4444" />
          <Text className="ml-3 text-red-500 font-inter-medium text-sm">
            Limpiar cola de sincronizacion
          </Text>
        </Pressable>
      </View>

      {/* Accounts section */}
      <SectionHeader title="Cuentas" />
      <View className="bg-white">
        {accounts.length === 0 ? (
          <View className="px-4 py-6 items-center">
            <Text className="text-gray-400 font-inter text-sm">
              Sin cuentas registradas
            </Text>
          </View>
        ) : (
          accounts.map((account, index) => (
            <View key={account.id}>
              {index > 0 && <View className="h-px bg-gray-100 ml-12" />}
              <View className="flex-row items-center px-4 py-3.5">
                <View
                  className="w-8 h-8 rounded-full items-center justify-center mr-3"
                  style={{
                    backgroundColor: (account.color || "#6B7280") + "20",
                  }}
                >
                  <Wallet
                    size={16}
                    color={account.color || "#6B7280"}
                  />
                </View>
                <View className="flex-1">
                  <Text className="text-gray-900 font-inter-medium text-sm">
                    {account.name}
                  </Text>
                  <Text className="text-gray-400 font-inter text-xs mt-0.5">
                    {accountTypeLabel(account.account_type)}
                  </Text>
                </View>
                <Text className="text-gray-900 font-inter-semibold text-sm">
                  {formatCurrency(
                    account.current_balance,
                    (account.currency_code as CurrencyCode) || "COP"
                  )}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Session section */}
      <SectionHeader title="Sesion" />
      <View className="bg-white mb-8">
        <SettingsRow
          icon={<LogOut size={18} color="#EF4444" />}
          label="Cerrar sesion"
          onPress={handleSignOut}
          destructive
        />
      </View>
    </ScrollView>
  );
}
