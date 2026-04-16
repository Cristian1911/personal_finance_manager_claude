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

export default function SignupScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSignup() {
    setError(null);

    if (!email.trim() || !password || !confirmPassword) {
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

    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });

    if (error) {
      setError(error.message);
    }
    // On success, onAuthStateChange in auth.tsx handles redirect to (tabs)

    setLoading(false);
  }

  return (
    <AppKeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: "#121412" }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: "center",
        paddingHorizontal: 32,
        paddingVertical: 24,
      }}
      bottomOffset={20}
    >
        <Text className="text-base font-inter-bold text-center text-z-brass mb-3">
          Zeta
        </Text>
        <Text className="text-3xl font-bold text-center text-foreground mb-2">
          Crear cuenta
        </Text>
        <Text className="text-base text-center text-muted-foreground mb-10">
          Empieza con claridad financiera
        </Text>

        {error && (
          <View className="bg-z-debt-12 border border-z-debt-25 rounded-lg p-3 mb-4">
            <Text className="text-z-debt text-sm text-center">{error}</Text>
          </View>
        )}

        <Text className="text-sm font-medium text-muted-foreground mb-1">
          Correo electrónico
        </Text>
        <TextInput
          className="border border-white-6 rounded-lg px-4 py-3 mb-4 text-base text-foreground bg-black-10"
          placeholder="correo@ejemplo.com"
          placeholderTextColor="#938C7E"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />

        <Text className="text-sm font-medium text-muted-foreground mb-1">
          Contraseña
        </Text>
        <TextInput
          className="border border-white-6 rounded-lg px-4 py-3 mb-4 text-base text-foreground bg-black-10"
          placeholder="Mínimo 6 caracteres"
          placeholderTextColor="#938C7E"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />

        <Text className="text-sm font-medium text-muted-foreground mb-1">
          Confirmar contraseña
        </Text>
        <TextInput
          className="border border-white-6 rounded-lg px-4 py-3 mb-6 text-base text-foreground bg-black-10"
          placeholder="Repite tu contraseña"
          placeholderTextColor="#938C7E"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />

        <TouchableOpacity
          className={`rounded-lg py-3.5 items-center ${
            loading ? "bg-z-brass-70" : "bg-z-brass"
          }`}
          onPress={handleSignup}
          disabled={loading}
          activeOpacity={0.8}
        >
          {loading ? (
            <ActivityIndicator color="#121412" />
          ) : (
            <Text className="text-z-ink font-semibold text-base">
              Crear cuenta
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className="mt-6 items-center"
          onPress={() => router.replace("/(auth)/login")}
        >
          <Text className="text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Text className="text-z-brass font-medium">Inicia sesión</Text>
          </Text>
        </TouchableOpacity>
    </AppKeyboardAwareScrollView>
  );
}
