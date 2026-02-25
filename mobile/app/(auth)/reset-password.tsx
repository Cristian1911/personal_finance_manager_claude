import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { useURL } from "expo-linking";
import { supabase } from "../../lib/supabase";

export default function ResetPasswordScreen() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [refreshToken, setRefreshToken] = useState<string | null>(null);
  const router = useRouter();
  const url = useURL();

  useEffect(() => {
    if (!url) return;

    // Supabase appends tokens in the URL fragment:
    // venti5://reset-password#access_token=xxx&refresh_token=yyy&type=recovery
    const hashIndex = url.indexOf("#");
    if (hashIndex === -1) return;

    const params = new URLSearchParams(url.substring(hashIndex + 1));
    const at = params.get("access_token");
    const rt = params.get("refresh_token");
    const type = params.get("type");

    if (at && rt && type === "recovery") {
      setAccessToken(at);
      setRefreshToken(rt);
    }
  }, [url]);

  async function handleResetPassword() {
    setError(null);

    if (!password || !confirmPassword) {
      setError("Todos los campos son obligatorios");
      return;
    }

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    if (!accessToken || !refreshToken) {
      setError("Enlace de recuperación inválido o expirado");
      return;
    }

    setLoading(true);

    // Establish the recovery session
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    if (sessionError) {
      setError(sessionError.message);
      setLoading(false);
      return;
    }

    // Update the password
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    // Sign out so the root layout redirects cleanly to login
    await supabase.auth.signOut();
    setLoading(false);
    router.replace("/(auth)/login");
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-white"
    >
      <View className="flex-1 justify-center px-8">
        <Text className="text-3xl font-bold text-center text-gray-900 mb-2">
          Nueva contraseña
        </Text>
        <Text className="text-base text-center text-gray-500 mb-10">
          Elige una contraseña segura para tu cuenta
        </Text>

        {error && (
          <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <Text className="text-red-700 text-sm text-center">{error}</Text>
          </View>
        )}

        <Text className="text-sm font-medium text-gray-700 mb-1">
          Nueva contraseña
        </Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base text-gray-900 bg-gray-50"
          placeholder="Mínimo 6 caracteres"
          placeholderTextColor="#9CA3AF"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />

        <Text className="text-sm font-medium text-gray-700 mb-1">
          Confirmar contraseña
        </Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3 mb-6 text-base text-gray-900 bg-gray-50"
          placeholder="Repite tu nueva contraseña"
          placeholderTextColor="#9CA3AF"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />

        <TouchableOpacity
          className={`rounded-lg py-3.5 items-center ${
            loading ? "bg-blue-400" : "bg-blue-600"
          }`}
          onPress={handleResetPassword}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">
              Guardar contraseña
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="mt-6 items-center"
          onPress={() => router.replace("/(auth)/login")}
        >
          <Text className="text-sm text-blue-600 font-medium">
            Volver al inicio de sesión
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}
