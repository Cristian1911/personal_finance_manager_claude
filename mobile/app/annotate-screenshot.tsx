import { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import {
  Canvas,
  Path,
  Skia,
  Image,
  useImage,
  useCanvasRef,
  ImageFormat,
} from "@shopify/react-native-skia";
import { File as ExpoFile, Paths } from "expo-file-system";
import { Undo2, Trash2, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useBugReport } from "../lib/bugReportMode";

type DrawnPath = {
  path: ReturnType<typeof Skia.Path.Make>;
  color: string;
  strokeWidth: number;
};

const COLORS = ["#EF4444", "#3B82F6", "#111827"] as const;
const STROKE_WIDTHS = [3, 6] as const;

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

export default function AnnotateScreenshotScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { pendingScreenshotUri, setAnnotatedScreenshotUri } = useBugReport();
  const canvasRef = useCanvasRef();

  const screenshotImage = useImage(pendingScreenshotUri ?? undefined);

  const [paths, setPaths] = useState<DrawnPath[]>([]);
  const [selectedColor, setSelectedColor] = useState<string>(COLORS[0]);
  const [strokeWidth, setStrokeWidth] = useState<number>(STROKE_WIDTHS[0]);

  const currentPath = useRef<ReturnType<typeof Skia.Path.Make> | null>(null);
  const currentColorRef = useRef(selectedColor);
  const currentStrokeRef = useRef(strokeWidth);
  currentColorRef.current = selectedColor;
  currentStrokeRef.current = strokeWidth;

  // Force re-renders while drawing
  const [, setDrawTick] = useState(0);

  const panGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e: { x: number; y: number }) => {
      const p = Skia.Path.Make();
      p.moveTo(e.x, e.y);
      currentPath.current = p;
    })
    .onUpdate((e: { x: number; y: number }) => {
      currentPath.current?.lineTo(e.x, e.y);
      setDrawTick((t) => t + 1);
    })
    .onEnd(() => {
      if (currentPath.current) {
        setPaths((prev) => [
          ...prev,
          {
            path: currentPath.current!,
            color: currentColorRef.current,
            strokeWidth: currentStrokeRef.current,
          },
        ]);
        currentPath.current = null;
      }
    });

  const handleUndo = useCallback(() => {
    setPaths((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setPaths([]);
  }, []);

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  const handleDone = useCallback(async () => {
    const snapshot = canvasRef.current?.makeImageSnapshot();
    if (!snapshot) {
      router.back();
      return;
    }

    const base64 = snapshot.encodeToBase64(ImageFormat.JPEG, 85);
    const fileName = `annotated-${Date.now()}.jpg`;
    const file = new ExpoFile(Paths.cache, fileName);
    file.write(base64, { encoding: "base64" });

    setAnnotatedScreenshotUri(file.uri);
    router.back();
  }, [canvasRef, setAnnotatedScreenshotUri, router]);

  // Compute image dimensions to fit screen while preserving aspect ratio
  const imgWidth = screenshotImage?.width() ?? SCREEN_W;
  const imgHeight = screenshotImage?.height() ?? SCREEN_H;
  const scale = Math.min(SCREEN_W / imgWidth, SCREEN_H / imgHeight);
  const drawW = imgWidth * scale;
  const drawH = imgHeight * scale;
  const offsetX = (SCREEN_W - drawW) / 2;
  const offsetY = (SCREEN_H - drawH) / 2;

  const toolbarBottom = insets.bottom + 12;

  return (
    <View style={styles.container}>
      <GestureDetector gesture={panGesture}>
        <Canvas ref={canvasRef} style={styles.canvas}>
          {screenshotImage && (
            <Image
              image={screenshotImage}
              x={offsetX}
              y={offsetY}
              width={drawW}
              height={drawH}
              fit="contain"
            />
          )}
          {paths.map((p, i) => (
            <Path
              key={i}
              path={p.path}
              color={p.color}
              style="stroke"
              strokeWidth={p.strokeWidth}
              strokeCap="round"
              strokeJoin="round"
            />
          ))}
          {currentPath.current && (
            <Path
              path={currentPath.current}
              color={selectedColor}
              style="stroke"
              strokeWidth={strokeWidth}
              strokeCap="round"
              strokeJoin="round"
            />
          )}
        </Canvas>
      </GestureDetector>

      <View style={[styles.toolbar, { bottom: toolbarBottom }]}>
        <View style={styles.toolbarRow}>
          <Pressable
            style={[styles.toolBtn, !paths.length && styles.toolBtnDisabled]}
            onPress={handleUndo}
            disabled={!paths.length}
          >
            <Undo2 size={18} color={paths.length ? "#374151" : "#D1D5DB"} />
          </Pressable>

          <Pressable
            style={[styles.toolBtn, !paths.length && styles.toolBtnDisabled]}
            onPress={handleClear}
            disabled={!paths.length}
          >
            <Trash2 size={18} color={paths.length ? "#374151" : "#D1D5DB"} />
          </Pressable>

          <View style={styles.colorPicker}>
            {COLORS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setSelectedColor(c)}
                style={[
                  styles.colorDot,
                  { backgroundColor: c },
                  selectedColor === c && styles.colorDotSelected,
                ]}
              />
            ))}
          </View>

          <Pressable
            style={styles.toolBtn}
            onPress={() =>
              setStrokeWidth((w) =>
                w === STROKE_WIDTHS[0] ? STROKE_WIDTHS[1] : STROKE_WIDTHS[0]
              )
            }
          >
            <View
              style={[
                styles.strokePreview,
                {
                  width: strokeWidth === STROKE_WIDTHS[0] ? 14 : 20,
                  height: strokeWidth === STROKE_WIDTHS[0] ? 3 : 6,
                },
              ]}
            />
          </Pressable>
        </View>

        <View style={styles.toolbarRow}>
          <Pressable style={styles.cancelBtn} onPress={handleCancel}>
            <X size={16} color="#6B7280" />
            <Text style={styles.cancelLabel}>Cancelar</Text>
          </Pressable>

          <Pressable style={styles.doneBtn} onPress={handleDone}>
            <Text style={styles.doneLabel}>Listo</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  canvas: {
    width: SCREEN_W,
    height: SCREEN_H,
  },
  toolbar: {
    position: "absolute",
    left: 12,
    right: 12,
    gap: 8,
  },
  toolbarRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  toolBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  toolBtnDisabled: {
    opacity: 0.5,
  },
  colorPicker: {
    flexDirection: "row",
    gap: 8,
    marginLeft: "auto",
  },
  colorDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorDotSelected: {
    borderColor: "#FFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  strokePreview: {
    backgroundColor: "#374151",
    borderRadius: 3,
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    gap: 4,
  },
  cancelLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
  },
  doneBtn: {
    marginLeft: "auto",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#047857",
  },
  doneLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFF",
  },
});
