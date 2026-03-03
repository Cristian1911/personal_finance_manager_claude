import { useCallback } from "react";
import {
  View,
  Image,
  Pressable,
  Text,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Pencil, Trash2 } from "lucide-react-native";
import { useBugReport } from "../lib/bugReportMode";

type Props = {
  screenshotUri: string;
  onAnnotated: (flattenedUri: string) => void;
};

export function ScreenshotAnnotator({ screenshotUri, onAnnotated }: Props) {
  const router = useRouter();
  const { annotatedScreenshotUri } = useBugReport();

  const displayUri = annotatedScreenshotUri || screenshotUri;

  const handleDone = useCallback(() => {
    onAnnotated(displayUri);
  }, [onAnnotated, displayUri]);

  return (
    <View style={styles.container}>
      <Image source={{ uri: displayUri }} style={styles.image} resizeMode="contain" />

      <View style={styles.toolbar}>
        <Pressable
          style={styles.annotateButton}
          onPress={() => router.push("/annotate-screenshot" as never)}
        >
          <Pencil size={14} color="#FFFFFF" />
          <Text style={styles.annotateLabel}>Anotar</Text>
        </Pressable>

        <Pressable style={styles.toolButton} onPress={() => onAnnotated("")}>
          <Trash2 size={14} color="#374151" />
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
  annotateButton: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#047857",
    gap: 4,
  },
  annotateLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FFFFFF",
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
  doneButton: {
    marginLeft: "auto",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  doneLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
  },
});
