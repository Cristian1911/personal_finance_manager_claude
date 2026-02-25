import { View, Text, ScrollView, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  User,
  Mail,
  RefreshCw,
  Clock,
  LogOut,
  Wallet,
  Shield,
  Trash2,
  ChevronRight,
} from "lucide-react-native";
import { formatRelativeDate } from "@venti5/shared";
import { useSync } from "../../lib/sync/hooks";
import { useAppStore } from "../../lib/store";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { clearDatabase, getDatabase } from "../../lib/db/database";

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
  const router = useRouter();
  const { session } = useAuth();
  const { status, lastSynced, sync } = useSync();
  const { profile, clear } = useAppStore();
  const [syncing, setSyncing] = useState(false);

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

  return (
    <ScrollView className="flex-1 bg-gray-100">
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
          <RefreshCw size={18} color="#047857" />
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
        <Pressable
          className="flex-row items-center px-4 py-3.5 active:bg-gray-50"
          onPress={() => router.navigate("/(tabs)/accounts")}
        >
          <View className="mr-3">
            <Wallet size={18} color="#6B7280" />
          </View>
          <Text className="flex-1 font-inter-medium text-sm text-gray-900">
            Administrar cuentas
          </Text>
          <ChevronRight size={16} color="#9CA3AF" />
        </Pressable>
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
