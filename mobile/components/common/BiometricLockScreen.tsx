import { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Fingerprint } from "lucide-react-native";
import { authenticateWithBiometrics } from "../../lib/biometrics";

export function BiometricLockScreen({
  onUnlock,
  onFallback,
}: {
  onUnlock: () => void;
  onFallback: () => void;
}) {
  useEffect(() => {
    attemptUnlock();
  }, []);

  async function attemptUnlock() {
    const success = await authenticateWithBiometrics();
    if (success) {
      onUnlock();
    }
  }

  return (
    <View style={styles.container}>
      <View className="items-center">
        <View className="h-20 w-20 rounded-full bg-emerald-100 items-center justify-center mb-6">
          <Fingerprint size={40} color="#047857" />
        </View>
        <Text className="text-2xl font-inter-bold text-gray-900 mb-2">
          Venti5
        </Text>
        <Text className="text-base font-inter text-gray-500 mb-10 text-center px-8">
          Usa tu huella o Face ID para desbloquear
        </Text>

        <Pressable
          onPress={attemptUnlock}
          className="rounded-xl bg-primary px-8 py-3.5 active:bg-emerald-700 mb-4"
        >
          <Text className="text-white font-inter-bold text-base">
            Desbloquear
          </Text>
        </Pressable>

        <Pressable onPress={onFallback} className="px-4 py-2">
          <Text className="text-sm font-inter-medium text-gray-500">
            Usar contraseña
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 999,
  },
});
