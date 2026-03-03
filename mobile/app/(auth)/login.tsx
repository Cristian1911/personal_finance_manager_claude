import { useState, useEffect } from "react";
import {
  Alert,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useRouter } from "expo-router";
import { Fingerprint } from "lucide-react-native";
import { supabase } from "../../lib/supabase";
import { seedDemoData } from "../../lib/demo-data";
import { enableDemoMode } from "../../lib/demo-mode";
import { useAuth } from "../../lib/auth";
import {
  isBiometricsAvailable,
  isBiometricsEnabled,
  enableBiometrics,
  hasBeenPromptedForBiometrics,
  markBiometricsPrompted,
  storeBiometricCredentials,
  getBiometricCredentials,
  hasBiometricCredentials,
  clearBiometricCredentials,
  authenticateForLogin,
} from "../../lib/biometrics";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canLoginWithBiometrics, setCanLoginWithBiometrics] = useState(false);
  const router = useRouter();
  const { setDemoMode } = useAuth();

  useEffect(() => {
    (async () => {
      const [available, enabled, hasCredentials] = await Promise.all([
        isBiometricsAvailable(),
        isBiometricsEnabled(),
        hasBiometricCredentials(),
      ]);
      const ready = available && enabled && hasCredentials;
      setCanLoginWithBiometrics(ready);
      if (ready) {
        handleBiometricLogin();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleBiometricLogin() {
    const success = await authenticateForLogin();
    if (!success) return;

    const credentials = await getBiometricCredentials();
    if (!credentials) return;

    setLoading(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });
    setLoading(false);

    if (signInError) {
      await clearBiometricCredentials();
      setCanLoginWithBiometrics(false);
      setError(
        "Las credenciales guardadas ya no son válidas. Ingresa con tu contraseña."
      );
    }
  }

  async function handleLogin() {
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    setLoading(false);

    // Offer biometric setup or refresh stored credentials
    try {
      const [available, alreadyEnabled, alreadyPrompted] = await Promise.all([
        isBiometricsAvailable(),
        isBiometricsEnabled(),
        hasBeenPromptedForBiometrics(),
      ]);

      if (alreadyEnabled) {
        // Refresh stored credentials silently on each password login
        await storeBiometricCredentials(email.trim(), password);
      } else if (available && !alreadyPrompted) {
        await markBiometricsPrompted();
        Alert.alert(
          "Desbloqueo biometrico",
          "¿Deseas usar huella o Face ID para ingresar más rápido sin escribir tu contraseña?",
          [
            { text: "No, gracias", style: "cancel" },
            {
              text: "Activar",
              onPress: async () => {
                await enableBiometrics();
                await storeBiometricCredentials(email.trim(), password);
              },
            },
          ]
        );
      }
    } catch (err) {
      console.error("Failed to check for biometrics prompt:", err);
    }
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
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: "#F3F4F6" }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: 32,
        paddingVertical: 24,
      }}
      bottomOffset={20}
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

        {canLoginWithBiometrics && (
          <TouchableOpacity
            className="items-center mb-8 gap-2"
            onPress={handleBiometricLogin}
            disabled={loading}
            activeOpacity={0.7}
          >
            <View className="bg-emerald-50 border border-emerald-200 rounded-full p-4">
              <Fingerprint size={36} color="#059669" />
            </View>
            <Text className="text-emerald-700 font-inter-medium text-sm">
              Ingresar con biometría
            </Text>
            <Text className="text-gray-400 font-inter text-xs">
              o usa tu correo y contraseña
            </Text>
          </TouchableOpacity>
        )}

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
    </KeyboardAwareScrollView>
  );
}
