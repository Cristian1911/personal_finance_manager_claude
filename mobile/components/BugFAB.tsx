// mobile/components/BugFAB.tsx
import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Bug, Camera } from "lucide-react-native";
import { useBugReport } from "../lib/bugReportMode";

export function BugFAB() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isBugMode, toggleBugMode, captureScreen } = useBugReport();
  const [capturing, setCapturing] = useState(false);

  async function handleCapture() {
    setCapturing(true);
    try {
      const uri = await captureScreen();
      toggleBugMode();
      router.push(`/bug-report?screenshotUri=${encodeURIComponent(uri)}` as never);
    } catch (err) {
      Alert.alert("Error", "No se pudo capturar la pantalla.");
    } finally {
      setCapturing(false);
    }
  }

  return (
    <View
      style={[
        styles.container,
        { bottom: insets.bottom + 80, right: insets.right + 16 },
      ]}
      pointerEvents="box-none"
    >
      {isBugMode ? (
        <Pressable
          style={styles.captureButton}
          onPress={handleCapture}
          disabled={capturing}
        >
          {capturing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Camera size={18} color="#fff" />
              <Text style={styles.captureLabel}>Capturar</Text>
            </>
          )}
        </Pressable>
      ) : (
        <Pressable style={styles.idleButton} onPress={toggleBugMode}>
          <Bug size={20} color="#6B7280" />
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 9999,
    alignItems: "flex-end",
  },
  idleButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  captureButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: "#DC2626",
    shadowColor: "#DC2626",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
    gap: 6,
  },
  captureLabel: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
});
