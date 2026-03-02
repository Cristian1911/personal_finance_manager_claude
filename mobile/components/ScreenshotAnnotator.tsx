import { useRef, useState, useCallback } from "react";
import {
  View,
  Image,
  Pressable,
  Text,
  StyleSheet,
  PanResponder,
  type GestureResponderEvent,
} from "react-native";
import Svg, { Path } from "react-native-svg";
import ViewShot, { captureRef } from "react-native-view-shot";
import { Undo2, Trash2 } from "lucide-react-native";

type Stroke = string; // SVG path data string

type Props = {
  screenshotUri: string;
  onAnnotated: (flattenedUri: string) => void;
};

const STROKE_COLOR = "#DC2626";
const STROKE_WIDTH = 3;

export function ScreenshotAnnotator({ screenshotUri, onAnnotated }: Props) {
  const viewShotRef = useRef<ViewShot>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentPath, setCurrentPath] = useState<string>("");

  // Track layout dimensions for SVG overlay sizing
  const [layoutSize, setLayoutSize] = useState({ width: 0, height: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        setCurrentPath(`M${locationX},${locationY}`);
      },
      onPanResponderMove: (e: GestureResponderEvent) => {
        const { locationX, locationY } = e.nativeEvent;
        setCurrentPath((prev) => `${prev} L${locationX},${locationY}`);
      },
      onPanResponderRelease: () => {
        setCurrentPath((prev) => {
          if (prev) {
            setStrokes((s) => [...s, prev]);
          }
          return "";
        });
      },
    })
  ).current;

  const handleUndo = useCallback(() => {
    setStrokes((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setStrokes([]);
  }, []);

  const handleDone = useCallback(async () => {
    if (!viewShotRef.current) return;
    const uri = await captureRef(viewShotRef, {
      format: "jpg",
      quality: 0.85,
    });
    onAnnotated(uri);
  }, [onAnnotated]);

  return (
    <View style={styles.container}>
      <ViewShot ref={viewShotRef} style={styles.canvas}>
        <Image
          source={{ uri: screenshotUri }}
          style={styles.image}
          resizeMode="contain"
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            setLayoutSize({ width, height });
          }}
        />
        <View style={styles.svgOverlay} {...panResponder.panHandlers}>
          <Svg
            width={layoutSize.width || "100%"}
            height={layoutSize.height || "100%"}
            style={StyleSheet.absoluteFill}
          >
            {strokes.map((d, i) => (
              <Path
                key={i}
                d={d}
                stroke={STROKE_COLOR}
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {currentPath ? (
              <Path
                d={currentPath}
                stroke={STROKE_COLOR}
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ) : null}
          </Svg>
        </View>
      </ViewShot>

      <View style={styles.toolbar}>
        <Pressable
          style={[styles.toolButton, !strokes.length && styles.toolButtonDisabled]}
          onPress={handleUndo}
          disabled={!strokes.length}
        >
          <Undo2 size={16} color={strokes.length ? "#374151" : "#D1D5DB"} />
          <Text
            style={[
              styles.toolLabel,
              !strokes.length && styles.toolLabelDisabled,
            ]}
          >
            Deshacer
          </Text>
        </Pressable>

        <Pressable
          style={[styles.toolButton, !strokes.length && styles.toolButtonDisabled]}
          onPress={handleClear}
          disabled={!strokes.length}
        >
          <Trash2 size={16} color={strokes.length ? "#374151" : "#D1D5DB"} />
          <Text
            style={[
              styles.toolLabel,
              !strokes.length && styles.toolLabelDisabled,
            ]}
          >
            Limpiar
          </Text>
        </Pressable>

        <Pressable style={styles.doneButton} onPress={handleDone}>
          <Text style={styles.doneLabel}>Listo</Text>
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
  canvas: {
    position: "relative",
  },
  image: {
    width: "100%",
    aspectRatio: 9 / 16,
  },
  svgOverlay: {
    ...StyleSheet.absoluteFillObject,
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
  toolButtonDisabled: {
    opacity: 0.5,
  },
  toolLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#374151",
  },
  toolLabelDisabled: {
    color: "#D1D5DB",
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
