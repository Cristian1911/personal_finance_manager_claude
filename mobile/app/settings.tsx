import {
  View,
  Text,
  ScrollView,
  Pressable,
  Alert,
  Switch,
} from "react-native";
import { MobileSheet } from "../components/ui/MobileSheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  RefreshCw,
  Clock,
  LogOut,
  Trash2,
  Fingerprint,
  ShieldCheck,
  ChevronRight,
  Wallet,
  X,
  Bug,
} from "lucide-react-native";
import { getAllAccounts, type AccountRow } from "../lib/repositories/accounts";
import {
  isBiometricsAvailable,
  isBiometricsEnabled,
  enableBiometrics,
  disableBiometrics,
  isBackgroundReauthEnabled,
  setBackgroundReauth,
} from "../lib/biometrics";
import { formatRelativeDate } from "@zeta/shared";
import { useSync } from "../lib/sync/hooks";
import { useAppStore } from "../lib/store";
import { useAuth } from "../lib/auth";
import { useBugReport } from "../lib/bugReportMode";
import { supabase } from "../lib/supabase";
import { clearDatabase, getDatabase } from "../lib/db/database";
import { disableDemoMode } from "../lib/demo-mode";
import { resetUserData } from "../lib/reset-data";
import { deleteUserAccount } from "../lib/delete-account";
import { useOnboardingStatus } from "../lib/onboarding-status";
import { useTheme, type ThemeMode } from "../lib/theme";
import { COLORS } from "../lib/constants/colors";
import { LEGAL_URLS, SUPPORT_EMAIL } from "../lib/constants/urls";
import {
  BRASS_GHOST_BUTTON_CLASS,
  PANEL_INSET_CLASS,
  SECTION_EYEBROW_CLASS,
} from "../lib/constants/styles";

function computeInitials(name: string, email: string): string {
  const trimmed = name.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).slice(0, 2);
    return parts.map((p) => p[0] ?? "").join("").toUpperCase() || "··";
  }
  return email.slice(0, 2).toUpperCase() || "··";
}

function SectionHeading({ label }: { label: string }) {
  return (
    <View className="flex-row items-center gap-3 mb-2 px-1">
      <Text className={SECTION_EYEBROW_CLASS}>{label}</Text>
      <View className="h-px flex-1 bg-white-6" />
    </View>
  );
}

function NavRow({
  title,
  meta,
  onPress,
  destructive = false,
}: {
  title: string;
  meta?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      className={`${PANEL_INSET_CLASS} flex-row items-center justify-between gap-3 px-4 py-3 active:bg-black-10`}
    >
      <View className="min-w-0 flex-1">
        <Text
          className={`text-sm font-inter-semibold ${
            destructive ? "text-z-debt" : "text-foreground"
          }`}
        >
          {title}
        </Text>
        {meta && (
          <Text
            className="mt-1 text-xs font-inter text-muted-foreground"
            numberOfLines={1}
          >
            {meta}
          </Text>
        )}
      </View>
      <ChevronRight
        size={16}
        color={destructive ? COLORS.debt : COLORS.sageDark}
      />
    </Pressable>
  );
}

function IdentityHero({
  name,
  email,
  onSignOut,
}: {
  name: string;
  email: string;
  onSignOut: () => void;
}) {
  const initials = computeInitials(name, email);
  const displayName = name.trim() || "Sin nombre";
  return (
    <View className="flex-row items-center gap-3 px-4 py-4">
      <View className="h-14 w-14 items-center justify-center rounded-full border border-z-brass-30 bg-z-brass-10">
        <Text className="text-lg font-inter-bold text-z-brass">{initials}</Text>
      </View>
      <View className="min-w-0 flex-1">
        <Text
          className="text-base font-inter-semibold text-foreground"
          numberOfLines={1}
        >
          {displayName}
        </Text>
        <Text
          className="text-xs font-inter text-muted-foreground"
          numberOfLines={1}
        >
          {email || "—"}
        </Text>
      </View>
      <Pressable
        onPress={onSignOut}
        className={`${BRASS_GHOST_BUTTON_CLASS} rounded-lg px-2.5 py-1.5`}
        accessibilityRole="button"
        accessibilityLabel="Cerrar sesión"
      >
        <Text className="text-[11px] font-inter-semibold text-z-brass">
          Cerrar sesión
        </Text>
      </Pressable>
    </View>
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
    <View className={`${PANEL_INSET_CLASS} p-3`}>
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

function ToggleRow({
  icon,
  label,
  value,
  onValueChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: boolean;
  onValueChange: (next: boolean) => void;
}) {
  return (
    <View
      className={`${PANEL_INSET_CLASS} flex-row items-center gap-3 px-4 py-3`}
    >
      <View>{icon}</View>
      <Text className="flex-1 text-sm font-inter-medium text-foreground">
        {label}
      </Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: COLORS.switchTrack, true: COLORS.income }}
        thumbColor={COLORS.foreground}
        ios_backgroundColor={COLORS.switchTrack}
      />
    </View>
  );
}

const DEFAULT_ACCOUNT_STORAGE_KEY = "zeta.default_capture_account_id";

function AccountPickerModal({
  visible,
  onClose,
  accounts,
  selectedId,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  accounts: AccountRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  return (
    <MobileSheet visible={visible} onClose={onClose}>
          <View className="flex-row items-center justify-between px-4 pb-3 border-b border-white-6">
            <Text className="text-base font-inter-bold text-foreground">
              Cuenta predeterminada
            </Text>
            <Pressable
              onPress={onClose}
              className="h-8 w-8 items-center justify-center rounded-full bg-black-10 active:bg-white/10"
              accessibilityLabel="Cerrar"
            >
              <X size={16} color={COLORS.sageDark} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 12 }}>
            <Pressable
              onPress={() => {
                onSelect(null);
                onClose();
              }}
              className={`flex-row items-center gap-2.5 rounded-lg px-3 py-3 active:bg-white/5 ${
                selectedId === null ? "bg-white/8" : ""
              }`}
            >
              <X size={14} color={COLORS.sageDark} />
              <Text className="flex-1 text-sm font-inter text-muted-foreground">
                Sin predeterminada (usar la última)
              </Text>
              {selectedId === null && <Check size={16} color={COLORS.brass} />}
            </Pressable>
            {accounts.map((acct) => {
              const isSel = acct.id === selectedId;
              return (
                <Pressable
                  key={acct.id}
                  onPress={() => {
                    onSelect(acct.id);
                    onClose();
                  }}
                  className={`mt-1 flex-row items-center gap-2.5 rounded-lg px-3 py-3 active:bg-white/5 ${
                    isSel ? "bg-white/8" : ""
                  }`}
                >
                  <Wallet size={14} color={COLORS.sageDark} />
                  <Text
                    className={`flex-1 text-sm ${
                      isSel
                        ? "text-z-brass font-inter-semibold"
                        : "text-foreground font-inter-medium"
                    }`}
                    numberOfLines={1}
                  >
                    {acct.name}
                  </Text>
                  {isSel && <Check size={16} color={COLORS.brass} />}
                </Pressable>
              );
            })}
          </ScrollView>
    </MobileSheet>
  );
}

function SyncStatusRow({
  status,
  syncing,
  lastSynced,
}: {
  status: string;
  syncing: boolean;
  lastSynced: Date | string | null;
}) {
  const label =
    status === "syncing" || syncing
      ? "Sincronizando…"
      : status === "error"
        ? "Error de sincronización"
        : "Sincronizado";
  return (
    <View className={`${PANEL_INSET_CLASS} px-4 py-3 gap-2`}>
      <View className="flex-row items-center gap-2">
        <RefreshCw
          size={14}
          color={status === "error" ? COLORS.debt : COLORS.sageDark}
        />
        <Text className="text-sm font-inter-medium text-foreground">
          {label}
        </Text>
      </View>
      <View className="flex-row items-center gap-2">
        <Clock size={12} color={COLORS.sageDark} />
        <Text className="text-xs font-inter text-muted-foreground">
          Última: {lastSynced ? formatRelativeDate(lastSynced) : "Nunca"}
        </Text>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { session, demoMode, setDemoMode } = useAuth();
  const { status, lastSynced, sync } = useSync();
  const { profile, clear } = useAppStore();
  const { isFabEnabled, setFabEnabled } = useBugReport();
  const { markIncomplete } = useOnboardingStatus();
  const [syncing, setSyncing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [biometricsAvailable, setBiometricsAvailable] = useState(false);
  const [biometricsOn, setBiometricsOn] = useState(false);
  const [bgReauthOn, setBgReauthOn] = useState(false);
  const [accountsList, setAccountsList] = useState<AccountRow[]>([]);
  const [defaultAccountId, setDefaultAccountId] = useState<string | null>(null);
  const [showAccountPicker, setShowAccountPicker] = useState(false);

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

  // Reload accounts + default every time the screen gains focus so stale
  // data (e.g. user deleted the default account elsewhere) is corrected.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      (async () => {
        const [accounts, storedDefault] = await Promise.all([
          getAllAccounts(),
          SecureStore.getItemAsync(DEFAULT_ACCOUNT_STORAGE_KEY),
        ]);
        if (!active) return;
        setAccountsList(accounts);
        const exists =
          storedDefault && accounts.some((a) => a.id === storedDefault);
        setDefaultAccountId(exists ? storedDefault : null);
      })();
      return () => {
        active = false;
      };
    }, [])
  );

  const handleSelectDefaultAccount = useCallback(async (id: string | null) => {
    setDefaultAccountId(id);
    if (id) {
      await SecureStore.setItemAsync(DEFAULT_ACCOUNT_STORAGE_KEY, id);
    } else {
      await SecureStore.deleteItemAsync(DEFAULT_ACCOUNT_STORAGE_KEY);
    }
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
      "Limpiar cola de sincronización",
      "Se eliminarán las operaciones pendientes. Los datos locales no se afectan.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Limpiar",
          style: "destructive",
          onPress: async () => {
            try {
              const db = await getDatabase();
              await db.runAsync("DELETE FROM sync_queue WHERE synced_at IS NULL");
              Alert.alert("Listo", "Cola de sincronización limpiada.");
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
      "Se borrarán los datos locales y se volverán a descargar desde la nube. No afecta tus datos remotos.",
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
                "La resincronización falló. Puedes intentarlo de nuevo."
              );
            } finally {
              setSyncing(false);
            }
          },
        },
      ]
    );
  }, [clear, sync]);

  const handleResetAllData = useCallback(() => {
    if (demoMode || !session?.user?.id) return;
    const userId = session.user.id;

    Alert.alert(
      "Borrar todos mis datos",
      "Se eliminarán cuentas, transacciones, presupuestos, deudas, recurrentes y categorías personalizadas. Tu cuenta y tu sesión se mantienen: volverás al onboarding. Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Continuar",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "¿Seguro?",
              "Última confirmación. Tus datos se borrarán del servidor y del dispositivo.",
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Borrar todo",
                  style: "destructive",
                  onPress: async () => {
                    setResetting(true);
                    try {
                      await resetUserData(userId);
                      clear();
                      markIncomplete();
                      router.replace("/onboarding" as never);
                    } catch (error) {
                      console.error("Reset user data error:", error);
                      Alert.alert(
                        "No se pudo borrar",
                        "Inténtalo de nuevo. Si persiste, cierra sesión y vuelve a entrar.",
                      );
                    } finally {
                      setResetting(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }, [clear, demoMode, markIncomplete, router, session?.user?.id]);

  const handleDeleteAccount = useCallback(() => {
    if (demoMode || !session?.user?.id) return;
    const userId = session.user.id;

    Alert.alert(
      "Eliminar cuenta",
      "Se eliminarán de forma permanente tu cuenta, transacciones, presupuestos, deudas, recurrentes, destinatarios y todas tus configuraciones. Esta acción no se puede deshacer.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Continuar",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Confirmación final",
              "Tu cuenta y todos los datos se borrarán para siempre. ¿Seguro?",
              [
                { text: "Cancelar", style: "cancel" },
                {
                  text: "Eliminar cuenta",
                  style: "destructive",
                  onPress: async () => {
                    setDeleting(true);
                    try {
                      await deleteUserAccount(userId);
                      clear();
                      router.replace("/(auth)/login");
                    } catch (error) {
                      console.error("Delete account error:", error);
                      Alert.alert(
                        "No se pudo eliminar",
                        `Inténtalo de nuevo. Si persiste, contacta soporte en ${SUPPORT_EMAIL}.`,
                      );
                    } finally {
                      setDeleting(false);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  }, [clear, demoMode, router, session?.user?.id]);

  const handleSignOut = useCallback(() => {
    Alert.alert("Cerrar sesión", "Se eliminarán los datos locales.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar sesión",
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
      "Se borrarán los datos de prueba y volverás al login.",
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

  const name =
    profile?.full_name || session?.user?.user_metadata?.full_name || "";
  const email = session?.user?.email ?? "";

  const { mode: themeMode } = useTheme();
  const inkCls = themeMode === "neutral" ? "bg-z-ink-neutral" : "bg-background";
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      className={`flex-1 ${inkCls}`}
      contentContainerStyle={{
        paddingTop: insets.top,
        paddingBottom: insets.bottom + 24,
      }}
    >
      <IdentityHero
        name={name}
        email={email}
        onSignOut={demoMode ? handleExitDemoMode : handleSignOut}
      />

      <View className="px-4 gap-5">
        <View>
          <SectionHeading label="Perfil y conexiones" />
          <View className="gap-2">
            <NavRow
              title="Administrar cuentas"
              meta="Bancos, tarjetas y efectivo"
              onPress={() => router.navigate("/(tabs)/accounts")}
            />
            <NavRow
              title="Cuenta predeterminada"
              meta={
                defaultAccountId
                  ? accountsList.find((a) => a.id === defaultAccountId)?.name ??
                    "Seleccionar"
                  : "Usar la última utilizada"
              }
              onPress={() => setShowAccountPicker(true)}
            />
            <NavRow
              title="Suscripciones"
              meta="Pagos recurrentes"
              onPress={() => router.push("/subscriptions" as never)}
            />
          </View>
        </View>

        <View>
          <SectionHeading label="Sincronización" />
          <View className="gap-2">
            <SyncStatusRow
              status={status}
              syncing={syncing}
              lastSynced={lastSynced}
            />
            <Pressable
              className={`${PANEL_INSET_CLASS} flex-row items-center gap-3 px-4 py-3 active:bg-black-10`}
              onPress={handleSyncNow}
              disabled={syncing}
            >
              <RefreshCw size={16} color={COLORS.sageLight} />
              <Text className="flex-1 text-sm font-inter-semibold text-primary">
                {syncing ? "Sincronizando…" : "Sincronizar ahora"}
              </Text>
            </Pressable>
            <Pressable
              className={`${PANEL_INSET_CLASS} flex-row items-center gap-3 px-4 py-3 active:bg-black-10`}
              onPress={handleClearSyncQueue}
            >
              <Trash2 size={16} color={COLORS.debt} />
              <Text className="flex-1 text-sm font-inter-medium text-z-debt">
                Limpiar cola de sincronización
              </Text>
            </Pressable>
            {!demoMode && (
              <Pressable
                className={`${PANEL_INSET_CLASS} flex-row items-center gap-3 px-4 py-3 active:bg-black-10`}
                onPress={handleFullResync}
                disabled={syncing}
              >
                <RefreshCw size={16} color={COLORS.debt} />
                <Text className="flex-1 text-sm font-inter-medium text-z-debt">
                  Resincronizar desde cero
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        <View>
          <SectionHeading label="Apariencia" />
          <ThemeSelector />
        </View>

        {biometricsAvailable && (
          <View>
            <SectionHeading label="Seguridad" />
            <View className="gap-2">
              <ToggleRow
                icon={<Fingerprint size={18} color={COLORS.sageDark} />}
                label="Desbloqueo biométrico"
                value={biometricsOn}
                onValueChange={handleToggleBiometrics}
              />
              {biometricsOn && (
                <ToggleRow
                  icon={<ShieldCheck size={18} color={COLORS.sageDark} />}
                  label="Bloquear al salir de la app"
                  value={bgReauthOn}
                  onValueChange={handleToggleBgReauth}
                />
              )}
            </View>
          </View>
        )}

        <View>
          <SectionHeading label="Privacidad y soporte" />
          <View className="gap-2">
            <NavRow
              title="Reportar bug"
              meta="Envíanos comentarios o errores"
              onPress={() => router.push("/bug-report" as never)}
            />
            <ToggleRow
              icon={<Bug size={18} color={COLORS.sageDark} />}
              label="Botón flotante de reporte"
              value={isFabEnabled}
              onValueChange={setFabEnabled}
            />
            <NavRow
              title="Política de privacidad"
              onPress={() => WebBrowser.openBrowserAsync(LEGAL_URLS.privacy)}
            />
            <NavRow
              title="Términos de servicio"
              onPress={() => WebBrowser.openBrowserAsync(LEGAL_URLS.terms)}
            />
          </View>
        </View>

        {!demoMode && (
          <View>
            <SectionHeading label="Zona de peligro" />
            <View className="gap-2">
              <Pressable
                className={`${PANEL_INSET_CLASS} flex-row items-center gap-3 px-4 py-3 active:bg-black-10`}
                onPress={handleResetAllData}
                disabled={resetting}
              >
                <Trash2 size={16} color={COLORS.debt} />
                <View className="flex-1">
                  <Text className="text-sm font-inter-semibold text-z-debt">
                    {resetting ? "Borrando datos…" : "Borrar todos mis datos"}
                  </Text>
                  <Text className="mt-0.5 text-xs font-inter text-muted-foreground">
                    Mantén tu cuenta y vuelve al onboarding
                  </Text>
                </View>
              </Pressable>
              <Pressable
                className={`${PANEL_INSET_CLASS} flex-row items-center gap-3 px-4 py-3 active:bg-black-10`}
                onPress={handleDeleteAccount}
                disabled={deleting}
                accessibilityRole="button"
                accessibilityLabel="Eliminar cuenta"
              >
                <Trash2 size={16} color={COLORS.debt} />
                <View className="flex-1">
                  <Text className="text-sm font-inter-semibold text-z-debt">
                    {deleting ? "Eliminando cuenta…" : "Eliminar cuenta"}
                  </Text>
                  <Text className="mt-0.5 text-xs font-inter text-muted-foreground">
                    Borra tu cuenta y todos tus datos. Permanente.
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        )}

        {demoMode && (
          <View className="gap-2">
            <Pressable
              className={`${PANEL_INSET_CLASS} flex-row items-center gap-3 px-4 py-3 active:bg-black-10`}
              onPress={handleExitDemoMode}
            >
              <LogOut size={16} color={COLORS.debt} />
              <Text className="flex-1 text-sm font-inter-medium text-z-debt">
                Salir de modo demo
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      <Text className="px-5 pt-8 pb-4 text-center font-inter text-[11px] leading-relaxed text-z-sage-dark">
        Zeta no es un asesor financiero. La información mostrada es solo para
        organizar tus finanzas personales.
      </Text>

      <AccountPickerModal
        visible={showAccountPicker}
        onClose={() => setShowAccountPicker(false)}
        accounts={accountsList}
        selectedId={defaultAccountId}
        onSelect={handleSelectDefaultAccount}
      />
    </ScrollView>
  );
}
