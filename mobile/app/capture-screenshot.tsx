import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
// Legacy submodule — `uploadAsync` only lives there; the new File/Directory API doesn't expose it.
import * as FileSystem from "expo-file-system/legacy";
import {
  ArrowLeft,
  Camera,
  Image as ImageIcon,
  CheckCircle,
  RefreshCw,
} from "lucide-react-native";

import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import {
  getAllAccounts,
  type AccountRow,
} from "../lib/repositories/accounts";
import { createTransactionAndApplyBalance } from "../lib/repositories/transactions";
import { findAndLinkLocalOccurrence } from "../lib/repositories/recurring";
import {
  DEBT_PAYMENT_CATEGORY_ID,
  isDebtInflow,
} from "../lib/transaction-semantics";
import {
  BRASS_BUTTON_CLASS,
  GHOST_BUTTON_CLASS,
  MOBILE_TAB_BAR_CLEARANCE,
} from "../lib/constants/styles";
import { COLORS } from "../lib/constants/colors";

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3000";

type ParsedTransaction = {
  date: string;
  description: string;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  currency?: string;
};

type ParsedStatement = {
  bank: string;
  currency: string;
  transactions: ParsedTransaction[];
};

type Step = "pick" | "preview" | "parsing" | "review" | "importing" | "done";

export default function CaptureScreenshotScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [step, setStep] = useState<Step>("pick");
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedStatement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const list = await getAllAccounts();
      setAccounts(list);
      if (list.length > 0) setSelectedAccountId(list[0].id);
    })();
  }, [userId]);

  const resetFlow = useCallback(() => {
    setStep("pick");
    setImageUri(null);
    setParsed(null);
    setError(null);
    setImportedCount(0);
  }, []);

  async function pickFromCamera() {
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permiso requerido",
        "Habilita el acceso a la cámara en Ajustes del sistema para capturar fotos de extractos.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.9,
      allowsEditing: false,
      mediaTypes: ["images"],
    });
    if (result.canceled || !result.assets?.[0]) return;
    setImageUri(result.assets[0].uri);
    setStep("preview");
  }

  async function pickFromGallery() {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permiso requerido",
        "Habilita el acceso a tus fotos en Ajustes del sistema para elegir imágenes de extractos.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      quality: 0.9,
      allowsEditing: false,
      mediaTypes: ["images"],
    });
    if (result.canceled || !result.assets?.[0]) return;
    setImageUri(result.assets[0].uri);
    setStep("preview");
  }

  async function uploadAndParse() {
    if (!imageUri) return;
    setStep("parsing");
    setError(null);

    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      const accessToken = currentSession?.access_token;
      if (!accessToken) throw new Error("Sesión expirada. Inicia sesión de nuevo.");

      const mimeType = imageUri.toLowerCase().endsWith(".png")
        ? "image/png"
        : imageUri.toLowerCase().endsWith(".webp")
        ? "image/webp"
        : "image/jpeg";

      const uploadResult = await Promise.race<FileSystem.FileSystemUploadResult>([
        FileSystem.uploadAsync(`${API_URL}/api/parse-image`, imageUri, {
          httpMethod: "POST",
          uploadType: FileSystem.FileSystemUploadType.MULTIPART,
          fieldName: "file",
          mimeType,
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("timeout-60s")), 60_000),
        ),
      ]);

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        let detail = "No se pudo analizar la imagen.";
        try {
          const body = JSON.parse(uploadResult.body);
          if (typeof body.error === "string") detail = body.error;
        } catch {
          /* keep default */
        }
        throw new Error(detail);
      }

      const body = JSON.parse(uploadResult.body) as {
        statements?: ParsedStatement[];
      };
      const statement = body.statements?.[0];
      if (!statement || statement.transactions.length === 0) {
        throw new Error(
          "No encontramos transacciones en la imagen. Asegúrate de que se vean completas y con buena luz.",
        );
      }
      setParsed(statement);
      setStep("review");
    } catch (err) {
      const message =
        err instanceof Error && err.message === "timeout-60s"
          ? "El servidor no respondió en 60 segundos."
          : err instanceof Error
          ? err.message
          : "Error desconocido procesando la imagen.";
      setError(message);
      setStep("preview");
    }
  }

  async function importAll() {
    if (!parsed || !userId) return;
    const account = accounts.find((a) => a.id === selectedAccountId);
    if (!account) {
      Alert.alert("Selecciona una cuenta", "Necesitamos saber a qué cuenta asociar estas transacciones.");
      return;
    }
    setStep("importing");
    setError(null);

    let count = 0;
    try {
      for (const t of parsed.transactions) {
        const isDebtPayment = isDebtInflow({
          direction: t.direction,
          accountType: account.account_type,
        });
        const txId = await createTransactionAndApplyBalance(
          {
            user_id: userId,
            account_id: account.id,
            category_id: isDebtPayment ? DEBT_PAYMENT_CATEGORY_ID : null,
            amount: t.amount,
            currency_code: (parsed.currency || account.currency_code) as CurrencyCode,
            direction: t.direction,
            description: t.description,
            merchant_name: t.description,
            raw_description: t.description,
            transaction_date: t.date,
            provider: "OCR",
            capture_method: "OCR_BATCH",
          },
          account
        );
        await findAndLinkLocalOccurrence(txId).catch(() => false);
        count++;
      }
      setImportedCount(count);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo importar todo.");
      setStep("review");
    }
  }

  return (
    <View
      className="flex-1 bg-z-ink"
      style={{ paddingTop: insets.top }}
    >
      {/* Header */}
      <View className="flex-row items-center gap-3 px-5 pb-3 pt-3">
        <Pressable
          onPress={() => (step === "pick" ? router.back() : resetFlow())}
          accessibilityRole="button"
          accessibilityLabel={step === "pick" ? "Volver" : "Reiniciar"}
          className="h-10 w-10 items-center justify-center rounded-full bg-z-surface-2-6"
        >
          <ArrowLeft size={18} color={COLORS.foreground} />
        </Pressable>
        <Text className="text-lg font-inter-semibold text-foreground">
          Capturar extracto
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: MOBILE_TAB_BAR_CLEARANCE,
          paddingHorizontal: 20,
        }}
        keyboardShouldPersistTaps="handled"
      >
        {step === "pick" && (
          <View className="mt-4 gap-3">
            <Text className="text-sm text-z-sage-dark">
              Toma una foto del extracto o elige una imagen de tu galería. Zeta detecta las transacciones automáticamente.
            </Text>
            <Pressable
              onPress={pickFromCamera}
              accessibilityRole="button"
              className={`${BRASS_BUTTON_CLASS} mt-4 flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4`}
            >
              <Camera size={18} color={COLORS.ink} />
              <Text className="text-base font-inter-semibold text-z-ink">
                Tomar foto
              </Text>
            </Pressable>
            <Pressable
              onPress={pickFromGallery}
              accessibilityRole="button"
              className={`${GHOST_BUTTON_CLASS} flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4`}
            >
              <ImageIcon size={18} color={COLORS.foreground} />
              <Text className="text-base font-inter-medium text-foreground">
                Elegir de galería
              </Text>
            </Pressable>
          </View>
        )}

        {(step === "preview" || step === "parsing") && imageUri && (
          <View className="mt-4 gap-3">
            <Image
              source={{ uri: imageUri }}
              resizeMode="contain"
              className="bg-white-6"
              style={{ width: "100%", height: 420, borderRadius: 16 }}
            />
            {error ? (
              <Text className="text-sm text-z-expense">{error}</Text>
            ) : null}
            {step === "parsing" ? (
              <View className="items-center py-4">
                <ActivityIndicator color={COLORS.brass} />
                <Text className="mt-2 text-sm text-z-sage-dark">
                  Analizando imagen…
                </Text>
              </View>
            ) : (
              <View className="gap-3">
                <Pressable
                  onPress={uploadAndParse}
                  accessibilityRole="button"
                  className={`${BRASS_BUTTON_CLASS} flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4`}
                >
                  <Text className="text-base font-inter-semibold text-z-ink">
                    Analizar
                  </Text>
                </Pressable>
                <Pressable
                  onPress={resetFlow}
                  accessibilityRole="button"
                  className={`${GHOST_BUTTON_CLASS} flex-row items-center justify-center gap-2 rounded-2xl px-4 py-3`}
                >
                  <RefreshCw size={16} color={COLORS.foreground} />
                  <Text className="text-sm font-inter-medium text-foreground">
                    Cambiar imagen
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {step === "review" && parsed && (
          <View className="mt-4 gap-4">
            <View>
              <Text className="text-xs uppercase tracking-[0.14em] text-z-sage-dark">
                {parsed.bank ?? "Extracto"}
              </Text>
              <Text className="mt-1 text-base font-inter-semibold text-foreground">
                {parsed.transactions.length} transacciones detectadas
              </Text>
            </View>

            <View className="gap-2">
              <Text className="text-xs uppercase tracking-[0.14em] text-z-sage-dark">
                Cuenta destino
              </Text>
              {accounts.length === 0 ? (
                <Text className="text-sm text-z-sage-dark">
                  No tienes cuentas creadas. Crea una primero desde Ajustes.
                </Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-2">
                  <View className="flex-row gap-2 px-2">
                    {accounts.map((a) => {
                      const isSelected = a.id === selectedAccountId;
                      return (
                        <Pressable
                          key={a.id}
                          onPress={() => setSelectedAccountId(a.id)}
                          className={`rounded-full border px-3 py-2 ${
                            isSelected
                              ? "border-z-brass bg-z-brass-15"
                              : "border-white-6 bg-z-surface-2-55"
                          }`}
                        >
                          <Text
                            className={`text-xs ${
                              isSelected ? "font-inter-semibold text-z-brass" : "text-foreground"
                            }`}
                          >
                            {a.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              )}
            </View>

            <View className="gap-2">
              {parsed.transactions.map((t, i) => (
                <View
                  key={i}
                  className="flex-row items-center justify-between rounded-2xl bg-z-surface-2-55 px-4 py-3"
                >
                  <View className="flex-1 pr-3">
                    <Text className="text-sm text-foreground" numberOfLines={1}>
                      {t.description || "Sin descripción"}
                    </Text>
                    <Text className="text-xs text-z-sage-dark">{t.date}</Text>
                  </View>
                  <Text
                    className={`text-sm font-inter-semibold ${
                      t.direction === "OUTFLOW" ? "text-z-expense" : "text-z-income"
                    }`}
                  >
                    {t.direction === "OUTFLOW" ? "-" : "+"}
                    {formatCurrency(
                      t.amount,
                      (parsed.currency ||
                        accounts.find((a) => a.id === selectedAccountId)?.currency_code ||
                        "COP") as CurrencyCode,
                    )}
                  </Text>
                </View>
              ))}
            </View>

            {error ? (
              <Text className="text-sm text-z-expense">{error}</Text>
            ) : null}

            <Pressable
              onPress={importAll}
              accessibilityRole="button"
              disabled={!selectedAccountId}
              className={`${BRASS_BUTTON_CLASS} flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4 ${
                !selectedAccountId ? "opacity-50" : ""
              }`}
            >
              <Text className="text-base font-inter-semibold text-z-ink">
                Importar {parsed.transactions.length}
              </Text>
            </Pressable>
          </View>
        )}

        {step === "importing" && (
          <View className="mt-6 items-center gap-3">
            <ActivityIndicator color={COLORS.brass} />
            <Text className="text-sm text-z-sage-dark">Importando transacciones…</Text>
          </View>
        )}

        {step === "done" && (
          <View className="mt-6 items-center gap-4">
            <CheckCircle size={48} color={COLORS.income} />
            <Text className="text-lg font-inter-semibold text-foreground">
              {importedCount} transacciones importadas
            </Text>
            <View className="w-full gap-3">
              <Pressable
                onPress={resetFlow}
                accessibilityRole="button"
                className={`${GHOST_BUTTON_CLASS} flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4`}
              >
                <Text className="text-base font-inter-medium text-foreground">
                  Capturar otra
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.replace("/(tabs)")}
                accessibilityRole="button"
                className={`${BRASS_BUTTON_CLASS} flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4`}
              >
                <Text className="text-base font-inter-semibold text-z-ink">
                  Volver a Inicio
                </Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}
