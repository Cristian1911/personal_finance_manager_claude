import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { getCurrencySymbol, type CurrencyCode } from "@zeta/shared";
import { MobileHeader } from "../../components/ui/MobileHeader";
import { COLORS } from "../../lib/constants/colors";
import {
  BRASS_BUTTON_CLASS,
  FORM_INPUT_CLASS,
  MOBILE_TAB_BAR_CLEARANCE,
} from "../../lib/constants/styles";
import { getLocalProfile, updateProfile } from "../../lib/profile";
import { CURRENCIES } from "../../lib/constants/accounts";

// Same 8 codes as the webapp profile schema enum (webapp/src/actions/profile.ts).
const CURRENCY_CODES = CURRENCIES.map((c) => c.code as CurrencyCode);

function FieldLabel({ children }: { children: string }) {
  return (
    <Text className="mb-1.5 text-[13px] font-inter-semibold text-foreground">
      {children}
    </Text>
  );
}

export default function PerfilScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>("COP");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const profile = await getLocalProfile();
        if (profile) {
          setName(profile.full_name ?? "");
          setCurrency((profile.preferred_currency as CurrencyCode | null) ?? "COP");
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
        Alert.alert("Error", "No se pudo cargar el perfil.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleSave = useCallback(async () => {
    if (name.trim().length < 2) {
      Alert.alert("Error", "El nombre debe tener al menos 2 caracteres.");
      return;
    }
    setSaving(true);
    try {
      await updateProfile({ full_name: name.trim(), preferred_currency: currency });
      router.back();
    } catch (error) {
      console.error("Failed to update profile:", error);
      Alert.alert("Error", "No se pudo guardar el perfil.");
      setSaving(false);
    }
  }, [name, currency, router]);

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false }} />
      <MobileHeader variant="sub" title="Perfil" />
      {loading ? (
        <View
          className="flex-1 items-center justify-center"
          accessibilityLabel="Cargando perfil"
        >
          <ActivityIndicator size="large" color={COLORS.brass} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: MOBILE_TAB_BAR_CLEARANCE,
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View className="mb-5">
            <FieldLabel>Nombre</FieldLabel>
            <TextInput
              accessibilityLabel="Nombre"
              value={name}
              onChangeText={setName}
              placeholder="Tu nombre"
              placeholderTextColor={COLORS.sageDark}
              className={FORM_INPUT_CLASS}
            />
          </View>

          <View className="mb-6">
            <FieldLabel>Moneda predeterminada</FieldLabel>
            <View
              accessibilityRole="radiogroup"
              accessibilityLabel="Moneda predeterminada"
              className="flex-row flex-wrap gap-2"
            >
              {CURRENCY_CODES.map((code) => {
                const selected = code === currency;
                return (
                  <Pressable
                    key={code}
                    onPress={() => setCurrency(code)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={code}
                    className={`rounded-xl border px-3.5 py-2.5 ${
                      selected
                        ? "border-z-brass bg-z-brass-12"
                        : "border-white-6 bg-z-surface-2"
                    }`}
                  >
                    <Text
                      className={`text-[13px] font-inter-semibold ${
                        selected ? "text-z-white" : "text-z-sage-light"
                      }`}
                    >
                      {code} {getCurrencySymbol(code)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable
            onPress={handleSave}
            disabled={saving}
            accessibilityRole="button"
            accessibilityState={{ disabled: saving }}
            className={`${BRASS_BUTTON_CLASS} items-center rounded-xl py-3.5 active:opacity-80`}
            style={saving ? { opacity: 0.6 } : undefined}
          >
            <Text className="text-sm font-inter-bold text-z-ink">
              {saving ? "Guardando..." : "Guardar"}
            </Text>
          </Pressable>
        </ScrollView>
      )}
    </View>
  );
}
