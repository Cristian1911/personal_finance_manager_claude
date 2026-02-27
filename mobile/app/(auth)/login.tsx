import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "../../lib/supabase";
import { seedDemoData } from "../../lib/demo-data";
import { enableDemoMode } from "../../lib/demo-mode";
import { useAuth } from "../../lib/auth";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { setDemoMode } = useAuth();

  async function handleLogin() {
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(error.message);
    }

    setLoading(false);
  }

  async function handleTryDemo() {
    setDemoLoading(true);
    setError(null);
    try {
      await seedDemoData();
      await enableDemoMode();
      setDemoMode(true);
      router.replace("/(tabs)");
    } catch (err) {
      console.error("Demo mode setup error:", err);
      setError("No se pudo iniciar el modo demo.");
    } finally {
      setDemoLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-gray-100"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          paddingHorizontal: 32,
          paddingVertical: 24,
        }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
      >
        <Text className="text-base font-inter-bold text-center text-emerald-600 mb-3">
          Venti5
        </Text>
        <Text className="text-3xl font-bold text-center text-gray-900 mb-2">
          Bienvenido
        </Text>
        <Text className="text-base text-center text-gray-500 mb-10">
          Tu dinero, con identidad y foco
        </Text>

        {error && (
          <View className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
            <Text className="text-red-700 text-sm text-center">{error}</Text>
          </View>
        )}

        <Text className="text-sm font-medium text-gray-700 mb-1">
          Correo electronico
        </Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3 mb-4 text-base text-gray-900 bg-gray-50"
          placeholder="correo@ejemplo.com"
          placeholderTextColor="#9CA3AF"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />

        <Text className="text-sm font-medium text-gray-700 mb-1">
          Contrasena
        </Text>
        <TextInput
          className="border border-gray-300 rounded-lg px-4 py-3 mb-6 text-base text-gray-900 bg-gray-50"
          placeholder="Tu contrasena"
          placeholderTextColor="#9CA3AF"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
        />

        <TouchableOpacity
          className={`rounded-lg py-3.5 items-center ${
            loading ? "bg-primary-light" : "bg-primary"
          }`}
          onPress={handleLogin}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-semibold text-base">
              Iniciar sesion
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className={`mt-3 rounded-lg py-3.5 items-center border ${
            demoLoading ? "border-gray-200 bg-gray-100" : "border-gray-300 bg-white"
          }`}
          onPress={handleTryDemo}
          disabled={demoLoading || loading}
          activeOpacity={0.8}
        >
          {demoLoading ? (
            <ActivityIndicator color="#6B7280" />
          ) : (
            <Text className="text-gray-700 font-semibold text-base">
              Probar demo sin cuenta
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="mt-4 items-center"
          onPress={() => router.push("/(auth)/forgot-password")}
        >
          <Text className="text-sm text-emerald-600 font-medium">
            ¿Olvidaste tu contraseña?
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="mt-4 items-center"
          onPress={() => router.push("/(auth)/signup")}
        >
          <Text className="text-sm text-gray-500">
            ¿No tienes cuenta?{" "}
            <Text className="text-emerald-600 font-medium">Regístrate</Text>
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
