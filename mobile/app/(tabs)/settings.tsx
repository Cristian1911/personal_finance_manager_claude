import { View, Text, ScrollView, Pressable, Alert, Switch } from "react-native";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  User,
  Mail,
  RefreshCw,
  Clock,
  LogOut,
  Wallet,
  Shield,
  Trash2,
  Bug,
  Repeat,
  ChevronRight,
  Fingerprint,
  ShieldCheck,
} from "lucide-react-native";
import {
  isBiometricsAvailable,
  isBiometricsEnabled,
  enableBiometrics,
  disableBiometrics,
  isBackgroundReauthEnabled,
  setBackgroundReauth,
} from "../../lib/biometrics";
import { formatRelativeDate } from "@zeta/shared";
import { useSync } from "../../lib/sync/hooks";
import { useAppStore } from "../../lib/store";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { clearDatabase, getDatabase } from "../../lib/db/database";
import { disableDemoMode } from "../../lib/demo-mode";
import { useTheme, type ThemeMode } from "../../lib/theme";
import { COLORS } from "../../lib/constants/colors";

function SectionHeader({ title }: { title: string }) {
  return (
    <Text className="text-muted-foreground font-inter-semibold text-xs uppercase px-4 pt-5 pb-2">
      {title}
    </Text>
  );
}

function ThemeSelector() {
  const { mode, setMode } = useTheme();
  const options: Array<{
    id: ThemeMode;
    label: string;
    blurb: string;
    swatch: string;
  }> = [
    { id: "sage", label: "Sage", blurb: "Verde cálido (actual)", swatch: "#1E221E" },
    { id: "neutral", label: "Neutral", blurb: "Gris oscuro sin tinte", swatch: "#18181b" },
  ];
  return (
    <View className="px-4 py-3">
      <View className="flex-row gap-2.5">
        {options.map((opt) => {
          const selected = opt.id === mode;
          return (
            <Pressable
              key={opt.id}
              onPress={() => setMode(opt.id)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`Tema ${opt.label}`}
              className={`flex-1 rounded-xl border px-3 py-3 ${
                selected
                  ? "border-z-brass bg-z-brass-8"
                  : "border-white-6 bg-z-surface-3"
              }`}
            >
              <View className="flex-row items-center gap-2">
                <View
                  style={{ backgroundColor: opt.swatch }}
                  className="h-5 w-5 rounded-full border border-white-10"
                />
                <Text
                  className={`font-inter-semibold text-sm ${
                    selected ? "text-z-brass" : "text-z-white"
                  }`}
                >
                  {opt.label}
                </Text>
              </View>
              <Text className="mt-1 font-inter text-[11px] text-z-sage-dark">
                {opt.blurb}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <Text className="mt-3 font-inter-italic text-[11px] text-z-sage-dark">
        Más temas en camino — incluido uno claro.
      </Text>
    </View>
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
      className="flex-row items-center px-4 py-3.5 bg-z-surface-2-55 active:bg-black-10"
      {...(onPress ? { onPress } : {})}
    >
      <View className="mr-3">{icon}</View>
      <Text
        className={`flex-1 font-inter-medium text-sm ${
          destructive ? "text-z-expense" : "text-foreground"
        }`}
      >
        {label}
      </Text>
      {value && (
        <Text className="text-muted-foreground font-inter text-sm">{value}</Text>
      )}
    </Wrapper>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { session, demoMode, setDemoMode } = useAuth();
  const { status, lastSynced, sync } = useSync();
  const { profile, clear } = useAppStore();
  const [syncing, setSyncing] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsOn, setBiometricsOn] = useState(false);
  const [bgReauthOn, setBgReauthOn] = useState(false);

  useEffect(() => {
    async function loadBiometricState() {
      const available = await isBiometricsAvailable();
      setBiometricsAvailable(available);
      if (available) {
        const [enabled, reauth] = await Promise.all([
          isBiometricsEnabled(),
          isBackgroundReauthEnabled(),
        ]);
        setBiometricsOn(enabled);
        setBgReauthOn(reauth);
      }
    }
    loadBiometricState();
  }, []);

  const handleToggleBiometrics = useCallback(async (value: boolean) => {
    setBiometricsOn(value);
    if (value) {
      await enableBiometrics();
    } else {
      await disableBiometrics();
      setBgReauthOn(false);
      await setBackgroundReauth(false);
    }
  }, []);

  const handleToggleBgReauth = useCallback(async (value: boolean) => {
    setBgReauthOn(value);
    await setBackgroundReauth(value);
  }, []);

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

  const handleFullResync = useCallback(() => {
    Alert.alert(
      "Resincronizar desde cero",
      "Se borraran los datos locales y se volveran a descargar desde la nube. No afecta tus datos remotos.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Resincronizar",
          style: "destructive",
          onPress: async () => {
            setSyncing(true);
            try {
              clear();
              await clearDatabase();
              await sync();
              Alert.alert("Listo", "Datos locales reconstruidos.");
            } catch (error) {
              console.error("Full resync error:", error);
              Alert.alert(
                "No se pudo completar",
                "La resincronizacion falló. Puedes intentarlo de nuevo."
              );
            } finally {
              setSyncing(false);
            }
          },
        },
      ]
    );
  }, [clear, sync]);

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

  const handleExitDemoMode = useCallback(() => {
    Alert.alert(
      "Salir de modo demo",
      "Se borraran los datos de prueba y volveras al login.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Salir",
          style: "destructive",
          onPress: async () => {
            try {
              await disableDemoMode();
              setDemoMode(false);
              await clearDatabase();
              clear();
              router.replace("/(auth)/login");
            } catch (error) {
              console.error("Exit demo mode error:", error);
            }
          },
        },
      ]
    );
  }, [clear, router, setDemoMode]);

  const syncStatusLabel =
    status === "syncing" || syncing
      ? "Sincronizando..."
      : status === "error"
        ? "Error de sincronizacion"
        : "Sincronizado";

  const { mode: themeMode } = useTheme();
  const inkCls = themeMode === "neutral" ? "bg-z-ink-neutral" : "bg-background";

  return (
    <ScrollView className={`flex-1 ${inkCls}`}>
      {/* Profile section */}
      <SectionHeader title="Perfil" />
      <View className="bg-z-surface-2-55">
        <SettingsRow
          icon={<User size={18} color="#938C7E" />}
          label="Nombre"
          value={profile?.full_name || session?.user?.user_metadata?.full_name || "---"}
        />
        <View className="h-px bg-white-6 ml-12" />
        <SettingsRow
          icon={<Mail size={18} color="#938C7E" />}
          label="Email"
          value={session?.user?.email || "---"}
        />
        <View className="h-px bg-white-6 ml-12" />
        <SettingsRow
          icon={<Shield size={18} color="#938C7E" />}
          label="Plan"
          value="Gratuito"
        />
      </View>

      {/* Sync section */}
      <SectionHeader title="Sincronizacion" />
      <View className="bg-z-surface-2-55">
        <SettingsRow
          icon={
            <RefreshCw
              size={18}
              color={status === "error" ? "#EF4444" : "#938C7E"}
            />
          }
          label="Estado"
          value={syncStatusLabel}
        />
        <View className="h-px bg-white-6 ml-12" />
        <SettingsRow
          icon={<Clock size={18} color="#938C7E" />}
          label="Ultima sincronizacion"
          value={lastSynced ? formatRelativeDate(lastSynced) : "Nunca"}
        />
        <View className="h-px bg-white-6 ml-12" />
        <Pressable
          className="flex-row items-center px-4 py-3.5 bg-z-surface-2-55 active:bg-black-10"
          onPress={handleSyncNow}
          disabled={syncing}
        >
          <RefreshCw size={18} color="#C5BFAE" />
          <Text className="ml-3 text-primary font-inter-bold text-sm">
            {syncing ? "Sincronizando..." : "Sincronizar ahora"}
          </Text>
        </Pressable>
        <View className="h-px bg-white-6 ml-12" />
        <Pressable
          className="flex-row items-center px-4 py-3.5 bg-z-surface-2-55 active:bg-black-10"
          onPress={handleClearSyncQueue}
        >
          <Trash2 size={18} color={COLORS.debt} />
          <Text className="ml-3 text-z-expense font-inter-medium text-sm">
            Limpiar cola de sincronizacion
          </Text>
        </Pressable>
        {!demoMode && (
          <>
            <View className="h-px bg-white-6 ml-12" />
            <Pressable
              className="flex-row items-center px-4 py-3.5 bg-z-surface-2-55 active:bg-black-10"
              onPress={handleFullResync}
              disabled={syncing}
            >
              <RefreshCw size={18} color={COLORS.debt} />
              <Text className="ml-3 text-z-expense font-inter-medium text-sm">
                Resincronizar desde cero
              </Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Appearance section */}
      <SectionHeader title="Apariencia" />
      <View className="bg-z-surface-2-55">
        <ThemeSelector />
      </View>

      {/* Accounts section */}
      <SectionHeader title="Cuentas" />
      <View className="bg-z-surface-2-55">
        <Pressable
          className="flex-row items-center px-4 py-3.5 active:bg-black-10"
          onPress={() => router.navigate("/(tabs)/accounts")}
        >
          <View className="mr-3">
            <Wallet size={18} color="#938C7E" />
          </View>
          <Text className="flex-1 font-inter-medium text-sm text-foreground">
            Administrar cuentas
          </Text>
          <ChevronRight size={16} color="#938C7E" />
        </Pressable>
        <View className="h-px bg-white-6 ml-12" />
        <Pressable
          className="flex-row items-center px-4 py-3.5 active:bg-black-10"
          onPress={() => router.push("/subscriptions" as never)}
        >
          <View className="mr-3">
            <Repeat size={18} color="#938C7E" />
          </View>
          <Text className="flex-1 font-inter-medium text-sm text-foreground">
            Suscripciones
          </Text>
          <ChevronRight size={16} color="#938C7E" />
        </Pressable>
      </View>

      {/* Security section */}
      {biometricsAvailable && (
        <>
          <SectionHeader title="Seguridad" />
          <View className="bg-z-surface-2-55">
            <View className="flex-row items-center px-4 py-3.5 bg-z-surface-2-55">
              <View className="mr-3">
                <Fingerprint size={18} color="#938C7E" />
              </View>
              <Text className="flex-1 font-inter-medium text-sm text-foreground">
                Desbloqueo biometrico
              </Text>
              <Switch
                value={biometricsOn}
                onValueChange={handleToggleBiometrics}
                trackColor={{ false: "#3A3A3A", true: COLORS.income }}
                thumbColor={COLORS.foreground}
                ios_backgroundColor="#3A3A3A"
              />
            </View>
            {biometricsOn && (
              <>
                <View className="h-px bg-white-6 ml-12" />
                <View className="flex-row items-center px-4 py-3.5 bg-z-surface-2-55">
                  <View className="mr-3">
                    <ShieldCheck size={18} color="#938C7E" />
                  </View>
                  <Text className="flex-1 font-inter-medium text-sm text-foreground">
                    Bloquear al salir de la app
                  </Text>
                  <Switch
                    value={bgReauthOn}
                    onValueChange={handleToggleBgReauth}
                    trackColor={{ false: "#3A3A3A", true: COLORS.income }}
                    thumbColor={COLORS.foreground}
                    ios_backgroundColor="#3A3A3A"
                  />
                </View>
              </>
            )}
          </View>
        </>
      )}

      {/* Session section */}
      <SectionHeader title="Sesion" />
      <View className="bg-z-surface-2-55 mb-8">
        {demoMode ? (
          <SettingsRow
            icon={<LogOut size={18} color={COLORS.debt} />}
            label="Salir modo demo"
            onPress={handleExitDemoMode}
            destructive
          />
        ) : (
          <SettingsRow
            icon={<LogOut size={18} color={COLORS.debt} />}
            label="Cerrar sesion"
            onPress={handleSignOut}
            destructive
          />
        )}
      </View>

      <SectionHeader title="Soporte" />
      <View className="bg-z-surface-2-55 mb-8">
        <SettingsRow
          icon={<Bug size={18} color="#938C7E" />}
          label="Quick capture de bug"
          onPress={() => router.push("/bug-report" as never)}
        />
      </View>
    </ScrollView>
  );
}
