import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { V2_DEBUG_ENABLED } from "../lib/v2/flags";
import { DisponibleBlock } from "../v2/components/DisponibleBlock";
import { DisponibleDetail } from "../v2/components/DisponibleDetail";
import { WidgetBody } from "../v2/components/widgets/WidgetCard";
import { InicioWidgetGrid } from "../v2/components/widgets/InicioWidgetGrid";
import { DISPONIBLE_CASES } from "../v2/gallery/disponible-cases";
import { WIDGET_CASES } from "../v2/gallery/widget-cases";
import { useV2Fonts } from "../v2/theme/fonts";
import { V2ThemeProvider, useV2Theme } from "../v2/theme/ThemeProvider";
import type { ColorMode, ThemeName } from "../v2/tokens";
import type { DetailPartKey, InicioWidget } from "@zeta/shared";

/**
 * v2 widget gallery (docs/mlp/13-widget-design-rules.md "Testing"): every
 * case × theme × light/dark. Widths 360/390/430 come from the web preview's
 * WIDTH (pnpm preview:web:shots "/v2-gallery?theme=nitido&mode=dark").
 * Widgets: "/v2-gallery?section=widgets&case=red&open=hoy&detail=porPagar" (case, open and detail optional).
 */
export default function V2GalleryRoute() {
  const params = useLocalSearchParams<{ theme?: string; mode?: string; only?: string; section?: string; case?: string; open?: string; detail?: string }>();
  const [theme, setTheme] = useState<ThemeName>(params.theme === "nitido" ? "nitido" : "oliva");
  const [mode, setMode] = useState<ColorMode>(params.mode === "dark" ? "dark" : "light");
  const fontsReady = useV2Fonts();
  if (!V2_DEBUG_ENABLED) return <Redirect href="/" />;
  if (!fontsReady) return null;
  return (
    <V2ThemeProvider name={theme} mode={mode}>
      <Gallery
        theme={theme} mode={mode} setTheme={setTheme} setMode={setMode} only={params.only}
        section={params.section} widgetCase={params.case} open={params.open} detail={params.detail}
      />
    </V2ThemeProvider>
  );
}

function Gallery(props: {
  theme: ThemeName;
  mode: ColorMode;
  setTheme: (t: ThemeName) => void;
  setMode: (m: ColorMode) => void;
  only?: string;
  section?: string;
  widgetCase?: string;
  open?: string;
  detail?: string;
}) {
  const t = useV2Theme();
  const insets = useSafeAreaInsets();
  const showWidgets = props.section !== "disponible";
  const showDisponible = props.section !== "widgets";
  const cases = !showDisponible ? [] : props.only ? DISPONIBLE_CASES.filter((c) => c.key === props.only) : DISPONIBLE_CASES;
  const widgetCases = !showWidgets ? [] : props.widgetCase ? WIDGET_CASES.filter((c) => c.key === props.widgetCase) : WIDGET_CASES;
  return (
    <ScrollView
      style={{ backgroundColor: t.colors.bg }}
      contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32, paddingHorizontal: 16, gap: 14 }}
    >
      <Text style={[styles.title, { color: t.colors.ink, fontFamily: t.fonts.uiSemibold }]}>Galería v2</Text>
      <View style={styles.row}>
        <Segment options={[["oliva", "Oliva afinada"], ["nitido", "Nítido"]]} value={props.theme} onChange={props.setTheme} />
        <Segment options={[["light", "Claro"], ["dark", "Oscuro"]]} value={props.mode} onChange={props.setMode} />
      </View>
      {cases.map((c) => (
        <View key={c.key} style={{ gap: 10 }}>
          <Text style={[styles.caseTitle, { color: t.colors.muted, fontFamily: t.fonts.mono }]}>{c.title.toUpperCase()}</Text>
          <DisponibleBlock view={c.view} onToggle={() => undefined} />
        </View>
      ))}
      {widgetCases.map((c) => (
        <View key={`w-${c.key}`} style={{ gap: 10 }}>
          <Text style={[styles.caseTitle, { color: t.colors.muted, fontFamily: t.fonts.mono }]}>
            {`WIDGETS · ${c.title.toUpperCase()}`}
          </Text>
          <DisponibleDetail detail={c.detail} initialOpen={(props.detail as DetailPartKey | undefined) ?? null} />
          <GalleryGrid widgets={c.widgets} initialOpen={props.open ?? null} />
          {!props.open && (
            <>
              <Text style={[styles.caseTitle, { color: t.colors.muted, fontFamily: t.fonts.mono }]}>ABIERTOS</Text>
              {c.widgets.map((w) => (
                <View key={w.id} style={[styles.panel, { backgroundColor: t.colors.card }, t.shadow]}>
                  <Text style={{ color: t.colors.ink, fontFamily: t.fonts.uiSemibold, fontSize: 15 }}>{w.title}</Text>
                  <WidgetBody widget={w} />
                </View>
              ))}
            </>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function GalleryGrid({ widgets, initialOpen }: { widgets: InicioWidget[]; initialOpen: string | null }) {
  const [open, setOpen] = useState<string | null>(initialOpen);
  return <InicioWidgetGrid widgets={widgets} open={open} onOpenChange={setOpen} />;
}

function Segment<T extends string>({ options, value, onChange }: { options: [T, string][]; value: T; onChange: (v: T) => void }) {
  const t = useV2Theme();
  return (
    <View style={[styles.segment, { borderColor: t.colors.control }]}>
      {options.map(([v, label]) => {
        const on = v === value;
        return (
          <Pressable
            hitSlop={6}
            key={v}
            onPress={() => onChange(v)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            style={[styles.segItem, on && { backgroundColor: t.colors.button }]}
          >
            <Text style={{ color: on ? t.colors.onButton : t.colors.ink, fontFamily: t.fonts.uiSemibold, fontSize: 14 }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  segment: { flexDirection: "row", borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  segItem: { paddingHorizontal: 12, paddingVertical: 8 },
  caseTitle: { fontSize: 11, letterSpacing: 1.2, marginTop: 6 },
  panel: { borderRadius: 18, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 12 },
});
