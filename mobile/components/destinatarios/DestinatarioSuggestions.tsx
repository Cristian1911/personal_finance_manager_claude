import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
import { Sparkles } from "lucide-react-native";
import { formatDate } from "@zeta/shared";
import { useAuth } from "../../lib/auth";
import { COLORS } from "../../lib/constants/colors";
import {
  BRASS_GHOST_BUTTON_CLASS,
  FORM_INPUT_CLASS,
  GHOST_BUTTON_CLASS,
} from "../../lib/constants/styles";
import { MCard } from "../ui/MCard";
import {
  createDestinatarioFromSuggestion,
  dismissDestinatarioSuggestion,
  type DestinatarioSuggestionResult,
} from "../../lib/repositories/destinatarios";

/** "CARULLA VIVERO" → "Carulla Vivero" — same capitalize the webapp prefill uses. */
function titleCase(pattern: string): string {
  return pattern
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

interface DestinatarioSuggestionsProps {
  suggestions: DestinatarioSuggestionResult[];
  loading: boolean;
  onChanged: () => void;
}

/**
 * D4: auto-detected merchant groupings from unmatched transactions. Accept
 * creates a destinatario + rule and links the matching transactions; dismiss
 * hides the pattern device-locally for 7 days (webapp localStorage parity).
 */
export function DestinatarioSuggestions({
  suggestions,
  loading,
  onChanged,
}: DestinatarioSuggestionsProps) {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  // Pattern being accepted (shows the inline name form) + its draft name.
  const [acceptingPattern, setAcceptingPattern] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [busyPattern, setBusyPattern] = useState<string | null>(null);

  const beginAccept = useCallback((s: DestinatarioSuggestionResult) => {
    setAcceptingPattern(s.cleanedPattern);
    setDraftName(titleCase(s.cleanedPattern));
  }, []);

  const handleCreate = useCallback(
    async (s: DestinatarioSuggestionResult) => {
      const name = draftName.trim();
      if (name.length < 2) {
        Alert.alert("Error", "El nombre debe tener al menos 2 caracteres.");
        return;
      }
      if (!userId) {
        Alert.alert("Error", "No hay sesión activa.");
        return;
      }
      setBusyPattern(s.cleanedPattern);
      try {
        const { linkedCount } = await createDestinatarioFromSuggestion({
          user_id: userId,
          name,
          pattern: s.cleanedPattern,
        });
        setAcceptingPattern(null);
        setDraftName("");
        Alert.alert(
          "Destinatario creado",
          linkedCount > 0
            ? `Se vincularon ${linkedCount} ${
                linkedCount === 1 ? "movimiento" : "movimientos"
              } a "${name}".`
            : `"${name}" quedó creado con su regla de detección.`
        );
        onChanged();
      } catch (error) {
        console.error("Failed to create destinatario from suggestion:", error);
        Alert.alert("Error", "No se pudo crear el destinatario.");
      } finally {
        setBusyPattern(null);
      }
    },
    [draftName, userId, onChanged]
  );

  const handleDismiss = useCallback(
    async (s: DestinatarioSuggestionResult) => {
      setBusyPattern(s.cleanedPattern);
      try {
        await dismissDestinatarioSuggestion(s.cleanedPattern);
        onChanged();
      } catch (error) {
        console.error("Failed to dismiss suggestion:", error);
        Alert.alert("Error", "No se pudo descartar la sugerencia.");
      } finally {
        setBusyPattern(null);
      }
    },
    [onChanged]
  );

  if (loading) {
    return (
      <View
        className="items-center py-10"
        accessibilityLabel="Cargando sugerencias"
      >
        <ActivityIndicator size="large" color={COLORS.brass} />
      </View>
    );
  }

  if (suggestions.length === 0) {
    return (
      <MCard className="items-center gap-2 p-6">
        <Sparkles size={20} color={COLORS.sageDark} />
        <Text className="text-sm font-inter-semibold text-foreground">
          Sin sugerencias por ahora
        </Text>
        <Text className="text-center text-[12px] font-inter text-muted-foreground leading-5">
          Cuando haya movimientos repetidos sin destinatario, aparecerán aquí
          agrupados para crearlos de una vez.
        </Text>
      </MCard>
    );
  }

  return (
    <View className="gap-2">
      {suggestions.map((s) => {
        const busy = busyPattern === s.cleanedPattern;
        const accepting = acceptingPattern === s.cleanedPattern;
        return (
          <MCard key={s.cleanedPattern} className="gap-2.5">
            <View className="flex-row items-center justify-between gap-3">
              <Text
                className="flex-1 text-sm font-inter-semibold text-foreground"
                numberOfLines={1}
              >
                {s.cleanedPattern}
              </Text>
              <Text className="text-[11px] font-inter text-muted-foreground tabular-nums">
                {s.count} mov.
              </Text>
            </View>
            <Text className="text-[11px] font-inter text-muted-foreground">
              {formatDate(s.dateRange.from, "dd MMM yyyy")} —{" "}
              {formatDate(s.dateRange.to, "dd MMM yyyy")}
            </Text>

            {accepting ? (
              <View className="gap-2">
                <TextInput
                  accessibilityLabel="Nombre del destinatario"
                  value={draftName}
                  onChangeText={setDraftName}
                  placeholder="Nombre del destinatario"
                  placeholderTextColor={COLORS.sageDark}
                  className={FORM_INPUT_CLASS}
                  autoFocus
                />
                <View className="flex-row gap-2">
                  <Pressable
                    onPress={() => void handleCreate(s)}
                    disabled={busy || draftName.trim().length < 2}
                    accessibilityRole="button"
                    accessibilityLabel="Crear destinatario"
                    accessibilityState={{
                      disabled: busy || draftName.trim().length < 2,
                    }}
                    className={`${BRASS_GHOST_BUTTON_CLASS} rounded-xl px-3.5 py-2 active:opacity-80`}
                    style={
                      busy || draftName.trim().length < 2
                        ? { opacity: 0.5 }
                        : undefined
                    }
                  >
                    {busy ? (
                      <ActivityIndicator size="small" color={COLORS.brass} />
                    ) : (
                      <Text className="text-xs font-inter-semibold text-z-brass">
                        Crear
                      </Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={() => setAcceptingPattern(null)}
                    disabled={busy}
                    accessibilityRole="button"
                    accessibilityLabel="Cancelar creación"
                    accessibilityState={{ disabled: busy }}
                    className={`${GHOST_BUTTON_CLASS} rounded-xl px-3.5 py-2 active:opacity-80`}
                  >
                    <Text className="text-xs font-inter-medium text-z-sage-light">
                      Cancelar
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View className="flex-row gap-2">
                <Pressable
                  onPress={() => beginAccept(s)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Crear destinatario para ${s.cleanedPattern}`}
                  accessibilityState={{ disabled: busy }}
                  className={`${BRASS_GHOST_BUTTON_CLASS} rounded-xl px-3.5 py-2 active:opacity-80`}
                  style={busy ? { opacity: 0.5 } : undefined}
                >
                  <Text className="text-xs font-inter-semibold text-z-brass">
                    Crear destinatario
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleDismiss(s)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Ignorar ${s.cleanedPattern}`}
                  accessibilityState={{ disabled: busy }}
                  className={`${GHOST_BUTTON_CLASS} rounded-xl px-3.5 py-2 active:opacity-80`}
                  style={busy ? { opacity: 0.5 } : undefined}
                >
                  <Text className="text-xs font-inter-medium text-z-sage-light">
                    Ignorar
                  </Text>
                </Pressable>
              </View>
            )}
          </MCard>
        );
      })}
    </View>
  );
}
