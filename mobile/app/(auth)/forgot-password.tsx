import { COLORS } from "../../lib/constants/colors";
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { AppKeyboardAwareScrollView } from "../../components/common/AppKeyboardAwareScrollView";
import { supabase } from "../../lib/supabase";

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  async function handleResetRequest() {
    setError(null);

    if (!email.trim()) {
      setError("Ingresa tu correo electrónico");
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: "zeta://reset-password",
    });

    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }

    setLoading(false);
  }

  return (
    <AppKeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: COLORS.ink }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: 32,
        paddingVertical: 24,
      }}
      bottomOffset={20}
    >
        <Text className="text-3xl font-bold text-center text-foreground mb-2">
          Recuperar contraseña
        </Text>
        <Text className="text-base text-center text-muted-foreground mb-10">
          Te enviaremos un enlace a tu correo
        </Text>

        {success ? (
          <View className="bg-z-income-12 border border-z-income-25 rounded-lg p-4 mb-6">
            <Text className="text-z-income text-sm text-center font-medium">
              Correo enviado
            </Text>
            <Text className="text-z-income text-sm text-center mt-1">
              Revisa tu bandeja de entrada y sigue las instrucciones para
              recuperar tu contraseña.
            </Text>
          </View>
        ) : (
          <>
            {error && (
              <View className="bg-z-debt-12 border border-z-debt-25 rounded-lg p-3 mb-4">
                <Text className="text-z-debt text-sm text-center">
                  {error}
                </Text>
              </View>
            )}

            <Text className="text-sm font-medium text-muted-foreground mb-1">
              Correo electrónico
            </Text>
            <TextInput
              className="border border-white-6 rounded-lg px-4 py-3 mb-6 text-base text-foreground bg-black-10"
              placeholder="correo@ejemplo.com"
              placeholderTextColor="#938C7E"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              textContentType="emailAddress"
            />

            <TouchableOpacity
              className={`rounded-lg py-3.5 items-center ${
                loading ? "bg-z-brass-70" : "bg-z-brass"
              }`}
              onPress={handleResetRequest}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color="#121412" />
              ) : (
                <Text className="text-z-ink font-semibold text-base">
                  Enviar enlace
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          className="mt-6 items-center"
          onPress={() => router.replace("/(auth)/login")}
        >
          <Text className="text-sm text-z-brass font-medium">
            Volver al inicio de sesión
          </Text>
        </TouchableOpacity>
    </AppKeyboardAwareScrollView>
  );
}
