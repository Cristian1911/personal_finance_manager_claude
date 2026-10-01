import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent, type TextStyle } from "react-native";

const MIN_SCALE = 0.62;

/**
 * Widget rule: the amount shrinks to fit (down to 62%) and is shortened
 * ("$14,4 M") only when the full amount can't fit at 62%. Measured by hand
 * instead of adjustsFontSizeToFit so iOS, Android and the web preview agree.
 * If even the short form doesn't fit it keeps shrinking (below 62%) rather
 * than clip: a readable number beats the floor.
 */
export function FittedAmount({
  full,
  short,
  color,
  fontFamily,
  size,
  style,
  align = "left",
}: {
  full: string;
  short: string;
  color: string;
  fontFamily: string;
  size: number;
  style?: TextStyle;
  align?: "left" | "center";
}) {
  const [box, setBox] = useState(0);
  const [widths, setWidths] = useState<{ full: number; short: number }>({ full: 0, short: 0 });
  const measure = (key: "full" | "short") => (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setWidths((prev) => (prev[key] === w ? prev : { ...prev, [key]: w }));
  };

  const ready = box > 0 && widths.full > 0 && widths.short > 0;
  const fullScale = ready ? Math.min(1, box / widths.full) : 1;
  const useShort = ready && fullScale < MIN_SCALE;
  const scale = useShort ? Math.min(1, box / widths.short) : fullScale;
  const fontSize = Math.floor(size * scale);
  const text = [style, { color, fontFamily }];

  return (
    <View style={styles.fit} onLayout={(e) => setBox(e.nativeEvent.layout.width)}>
      <Text
        style={[text, { fontSize, lineHeight: Math.round(fontSize * 1.14), opacity: ready ? 1 : 0, textAlign: align }]}
        numberOfLines={1}
      >
        {useShort ? short : full}
      </Text>
      {/* Natural widths at full size, off-screen and invisible. */}
      <View style={styles.measure} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Text style={[text, styles.measured, { fontSize: size }]} onLayout={measure("full")}>{full}</Text>
        <Text style={[text, styles.measured, { fontSize: size }]} onLayout={measure("short")}>{short}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fit: { overflow: "hidden", alignSelf: "stretch" },
  measure: { position: "absolute", top: 0, left: 0, width: 10_000, opacity: 0 },
  measured: { alignSelf: "flex-start", marginTop: 0 },
});
