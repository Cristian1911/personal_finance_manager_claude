import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";
import {
  ArrowLeft,
  Mic,
  Square,
  CheckCircle,
  RefreshCw,
} from "lucide-react-native";

import {
  formatCurrency,
  parseQuickCaptureText,
  type CurrencyCode,
} from "@zeta/shared";
import { useAuth } from "../lib/auth";
import {
  getAllAccounts,
  type AccountRow,
} from "../lib/repositories/accounts";
import { createTransaction } from "../lib/repositories/transactions";
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

type Step = "idle" | "listening" | "review" | "saving" | "done";

type Parsed = {
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  description: string;
  transaction_date: string;
};

export default function CaptureVoiceScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuth();
  const userId = session?.user?.id;

  const [step, setStep] = useState<Step>("idle");
  const [transcript, setTranscript] = useState("");
  const [finalTranscript, setFinalTranscript] = useState("");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);

  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!userId) return;
    void (async () => {
      const list = await getAllAccounts();
      setAccounts(list);
      if (list.length > 0) setSelectedAccountId(list[0].id);
    })();
  }, [userId]);

  useEffect(() => {
    if (step !== "listening") {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.25,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [step, pulse]);

  useSpeechRecognitionEvent("result", (event) => {
    const res = event.results[0];
    if (!res) return;
    setTranscript(res.transcript);
    if (event.isFinal) {
      setFinalTranscript(res.transcript);
    }
  });

  useSpeechRecognitionEvent("end", () => {
    setStep((prev) => (prev === "listening" ? "review" : prev));
  });

  useSpeechRecognitionEvent("error", (event) => {
    setError(
      event.error === "not-allowed"
        ? "Permiso de micrófono denegado."
        : `Error de reconocimiento: ${event.message || event.error}`,
    );
    setStep("idle");
  });

  useEffect(() => {
    if (step !== "review") return;
    const text = finalTranscript || transcript;
    if (!text.trim()) {
      setError("No se capturó audio. Intenta de nuevo.");
      return;
    }
    const result = parseQuickCaptureText(text);
    if (result.success && result.data) {
      setParsed({
        amount: result.data.amount,
        direction: result.data.direction,
        description: result.data.description,
        transaction_date: result.data.transaction_date,
      });
      setError(null);
    } else {
      const message = !result.success
        ? result.error ?? "No pude interpretar lo que dijiste."
        : "No pude interpretar lo que dijiste.";
      setError(message);
      setParsed(null);
    }
  }, [step, transcript, finalTranscript]);

  const startListening = useCallback(async () => {
    setError(null);
    setTranscript("");
    setFinalTranscript("");
    setParsed(null);

    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permisos requeridos",
        "Habilita micrófono y reconocimiento de voz en Ajustes del sistema.",
      );
      return;
    }
    ExpoSpeechRecognitionModule.start({
      lang: "es-CO",
      interimResults: true,
      continuous: false,
      requiresOnDeviceRecognition: false,
      addsPunctuation: false,
    });
    setStep("listening");
  }, []);

  const stopListening = useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      /* noop */
    }
  }, []);

  const reset = useCallback(() => {
    setStep("idle");
    setTranscript("");
    setFinalTranscript("");
    setParsed(null);
    setError(null);
  }, []);

  const saveTransaction = useCallback(async () => {
    if (!parsed || !userId) return;
    const account = accounts.find((a) => a.id === selectedAccountId);
    if (!account) {
      Alert.alert("Cuenta requerida", "Selecciona una cuenta para guardar la transacción.");
      return;
    }
    setStep("saving");
    setError(null);

    try {
      const isDebtPayment = isDebtInflow({
        direction: parsed.direction,
        accountType: account.account_type,
      });
      await createTransaction({
        user_id: userId,
        account_id: account.id,
        category_id: isDebtPayment ? DEBT_PAYMENT_CATEGORY_ID : null,
        amount: parsed.amount,
        currency_code: (account.currency_code || "COP") as CurrencyCode,
        direction: parsed.direction,
        description: parsed.description,
        merchant_name: parsed.description,
        raw_description: parsed.description,
        transaction_date: parsed.transaction_date,
        provider: "MANUAL",
        capture_method: "TEXT_QUICK_CAPTURE",
        capture_input_text: finalTranscript || transcript,
      });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
      setStep("review");
    }
  }, [parsed, userId, accounts, selectedAccountId, finalTranscript, transcript]);

  return (
    <View className="flex-1 bg-z-ink" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center gap-3 px-5 pb-3 pt-3">
        <Pressable
          onPress={() => (step === "idle" ? router.back() : reset())}
          accessibilityRole="button"
          accessibilityLabel={step === "idle" ? "Volver" : "Reiniciar"}
          className="h-10 w-10 items-center justify-center rounded-full bg-white-6"
        >
          <ArrowLeft size={18} color={COLORS.foreground} />
        </Pressable>
        <Text className="text-lg font-semibold text-z-fg">
          Capturar por voz
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          paddingBottom: MOBILE_TAB_BAR_CLEARANCE,
          paddingHorizontal: 20,
        }}
      >
        {step === "idle" && (
          <View className="mt-6 gap-4 items-center">
            <Text className="text-sm text-z-fg-dim text-center">
              Pulsa el micrófono y di el movimiento. Ejemplo: &quot;Gasté 50 mil en Éxito ayer&quot; o &quot;Ingreso de 3 millones por salario&quot;.
            </Text>
            <Text className="text-xs text-z-fg-dim text-center">
              La transcripción ocurre en tu dispositivo. El audio no se envía a ningún servidor.
            </Text>
            {error ? (
              <Text className="text-sm text-z-negative text-center">{error}</Text>
            ) : null}
            <Pressable
              onPress={startListening}
              accessibilityRole="button"
              className={`${BRASS_BUTTON_CLASS} mt-4 h-24 w-24 items-center justify-center rounded-full`}
            >
              <Mic size={36} color={COLORS.ink} />
            </Pressable>
          </View>
        )}

        {step === "listening" && (
          <View className="mt-6 gap-4 items-center">
            <Animated.View
              style={{ transform: [{ scale: pulse }] }}
              className="h-24 w-24 items-center justify-center rounded-full bg-z-brass-15"
            >
              <Mic size={36} color={COLORS.brass} />
            </Animated.View>
            <Text className="text-sm font-medium text-z-fg">Escuchando…</Text>
            <View className="w-full rounded-2xl bg-z-surface-2-55 px-4 py-3 min-h-20">
              <Text className="text-base text-z-fg">
                {transcript || "…"}
              </Text>
            </View>
            <Pressable
              onPress={stopListening}
              accessibilityRole="button"
              className={`${GHOST_BUTTON_CLASS} flex-row items-center justify-center gap-2 rounded-2xl px-4 py-3`}
            >
              <Square size={16} color={COLORS.foreground} />
              <Text className="text-sm font-medium text-z-fg">Detener</Text>
            </Pressable>
          </View>
        )}

        {step === "review" && (
          <View className="mt-6 gap-4">
            <View className="rounded-2xl bg-z-surface-2-55 px-4 py-3">
              <Text className="text-xs uppercase tracking-[0.14em] text-z-fg-dim">
                Dijiste
              </Text>
              <Text className="mt-1 text-base text-z-fg">
                {finalTranscript || transcript || "(vacío)"}
              </Text>
            </View>

            {parsed ? (
              <>
                <View className="gap-2 rounded-2xl bg-z-surface-2-55 px-4 py-3">
                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs uppercase tracking-[0.14em] text-z-fg-dim">
                      Detectado
                    </Text>
                    <Text
                      className={`text-sm font-semibold ${
                        parsed.direction === "OUTFLOW"
                          ? "text-z-negative"
                          : "text-z-positive"
                      }`}
                    >
                      {parsed.direction === "OUTFLOW" ? "Gasto" : "Ingreso"}
                    </Text>
                  </View>
                  <Text className="text-xl font-semibold text-z-fg">
                    {formatCurrency(parsed.amount, "COP")}
                  </Text>
                  <Text className="text-sm text-z-fg">{parsed.description}</Text>
                  <Text className="text-xs text-z-fg-dim">{parsed.transaction_date}</Text>
                </View>

                <View className="gap-2">
                  <Text className="text-xs uppercase tracking-[0.14em] text-z-fg-dim">
                    Cuenta destino
                  </Text>
                  {accounts.length === 0 ? (
                    <Text className="text-sm text-z-fg-dim">
                      No tienes cuentas. Crea una primero desde Ajustes.
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
                                  isSelected ? "font-semibold text-z-brass" : "text-z-fg"
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

                {error ? (
                  <Text className="text-sm text-z-negative">{error}</Text>
                ) : null}

                <View className="gap-2">
                  <Pressable
                    onPress={saveTransaction}
                    accessibilityRole="button"
                    disabled={!selectedAccountId}
                    className={`${BRASS_BUTTON_CLASS} flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4 ${
                      !selectedAccountId ? "opacity-50" : ""
                    }`}
                  >
                    <Text className="text-base font-semibold text-z-ink">
                      Guardar transacción
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={reset}
                    accessibilityRole="button"
                    className={`${GHOST_BUTTON_CLASS} flex-row items-center justify-center gap-2 rounded-2xl px-4 py-3`}
                  >
                    <RefreshCw size={16} color={COLORS.foreground} />
                    <Text className="text-sm font-medium text-z-fg">
                      Intentar de nuevo
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <View className="gap-3">
                <Text className="text-sm text-z-negative">
                  {error ?? "No pude interpretar lo que dijiste."}
                </Text>
                <Pressable
                  onPress={reset}
                  accessibilityRole="button"
                  className={`${BRASS_BUTTON_CLASS} flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4`}
                >
                  <Text className="text-base font-semibold text-z-ink">
                    Intentar de nuevo
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        )}

        {step === "saving" && (
          <View className="mt-6 items-center gap-3">
            <ActivityIndicator color={COLORS.brass} />
            <Text className="text-sm text-z-fg-dim">Guardando…</Text>
          </View>
        )}

        {step === "done" && (
          <View className="mt-6 items-center gap-4">
            <CheckCircle size={48} color={COLORS.income} />
            <Text className="text-lg font-semibold text-z-fg">
              Transacción guardada
            </Text>
            <View className="w-full gap-3">
              <Pressable
                onPress={reset}
                accessibilityRole="button"
                className={`${GHOST_BUTTON_CLASS} flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4`}
              >
                <Text className="text-base font-medium text-z-fg">
                  Capturar otra
                </Text>
              </Pressable>
              <Pressable
                onPress={() => router.replace("/(tabs)")}
                accessibilityRole="button"
                className={`${BRASS_BUTTON_CLASS} flex-row items-center justify-center gap-2 rounded-2xl px-4 py-4`}
              >
                <Text className="text-base font-semibold text-z-ink">
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
