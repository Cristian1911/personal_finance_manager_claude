import { useCallback } from "react";
import {
  View,
  Image,
  Pressable,
  Text,
  StyleSheet,
} from "react-native";
import { Trash2 } from "lucide-react-native";

type Props = {
  screenshotUri: string;
  onAnnotated: (flattenedUri: string) => void;
};

export function ScreenshotAnnotator({ screenshotUri, onAnnotated }: Props) {
  const handleDone = useCallback(async () => {
    onAnnotated(screenshotUri);
  }, [onAnnotated, screenshotUri]);

  return (
    <View style={styles.container}>
      <Image source={{ uri: screenshotUri }} style={styles.image} resizeMode="contain" />

      <View style={styles.toolbar}>
        <View style={styles.previewCopy}>
          <Text style={styles.toolLabel}>Vista previa de la captura</Text>
          <Text style={styles.helperLabel}>
            La anotacion se desactivo temporalmente para evitar fallos del emulador.
          </Text>
        </View>

        <Pressable style={styles.toolButton} onPress={() => onAnnotated("")}>
          <Trash2 size={16} color="#374151" />
          <Text style={styles.toolLabel}>Quitar</Text>
        </Pressable>

        <Pressable style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneLabel}>Usar captura</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    aspectRatio: 9 / 16,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#F9FAFB",
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 8,
  },
  toolButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 4,
  },
  toolLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#374151",
  },
  helperLabel: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  previewCopy: {
    flex: 1,
  },
  doneButton: {
    marginLeft: "auto",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#047857",
  },
  doneLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
