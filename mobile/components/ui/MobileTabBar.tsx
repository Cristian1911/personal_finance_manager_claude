import { useState } from "react";
import { Alert, View, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardState } from "react-native-keyboard-controller";
import { Plus } from "lucide-react-native";
import { useRouter } from "expo-router";
import { COLORS } from "../../lib/constants/colors";
import { FabMenuSheet, type FabMenuAction } from "./FabMenuSheet";
import {
  LayoutDashboard,
  ArrowLeftRight,
  PiggyBank,
  Landmark,
} from "lucide-react-native";

const TABS = [
  { name: "index", title: "Inicio", icon: LayoutDashboard },
  { name: "transactions", title: "Movim.", icon: ArrowLeftRight },
  // FAB goes here (index 2)
  { name: "plan", title: "Plan", icon: PiggyBank },
  { name: "deudas", title: "Deudas", icon: Landmark },
] as const;

const LEFT_TABS = TABS.slice(0, 2);
const RIGHT_TABS = TABS.slice(2);

interface TabBarProps {
  state: { routes: Array<{ name: string }>; index: number };
  navigation: { navigate: (name: string) => void };
}

type TabDef = (typeof TABS)[number];

function TabButton({
  tab,
  active,
  onPress,
}: {
  tab: TabDef;
  active: boolean;
  onPress: () => void;
}) {
  const Icon = tab.icon;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={tab.title}
      accessibilityState={{ selected: active }}
      className="flex-1 items-center gap-0.5 py-2.5"
    >
      <Icon size={20} color={active ? COLORS.brass : COLORS.sageDark} />
      <Text
        className={`text-[11px] font-inter-medium ${
          active ? "text-z-brass" : "text-muted-fg-70"
        }`}
      >
        {tab.title}
      </Text>
    </Pressable>
  );
}

export function MobileTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const keyboardVisible = useKeyboardState((s) => s.isVisible);
  const [menuOpen, setMenuOpen] = useState(false);

  function handleFabAction(action: FabMenuAction) {
    switch (action) {
      case "new-transaction":
        router.push("/capture" as never);
        return;
      case "quick-capture":
        // TODO: mobile quick-capture (NL text parse) screen — reuse parseQuickCaptureText.
        Alert.alert("Próximamente", "La captura rápida llega en la siguiente versión.");
        return;
      case "voice":
        Alert.alert("Próximamente", "La captura por voz llega en la siguiente versión.");
        return;
      case "screenshot":
        Alert.alert("Próximamente", "La importación por pantallazo llega en la siguiente versión.");
        return;
    }
  }

  // Hide tab bar when keyboard is open
  if (keyboardVisible) return null;

  return (
    <>
    <FabMenuSheet
      visible={menuOpen}
      onClose={() => setMenuOpen(false)}
      onAction={handleFabAction}
    />
    <View
      className="border-t border-white-6 bg-background-92"
      style={{ paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center h-14">
        <View className="flex-1 flex-row items-center justify-around">
          {LEFT_TABS.map((tab) => {
            const routeIndex = state.routes.findIndex(
              (r) => r.name === tab.name
            );
            return (
              <TabButton
                key={tab.name}
                tab={tab}
                active={state.index === routeIndex}
                onPress={() => navigation.navigate(tab.name)}
              />
            );
          })}
        </View>

        {/* Center FAB */}
        <View className="items-center justify-center px-4">
          <Pressable
            onPress={() => setMenuOpen(true)}
            accessibilityRole="button"
            accessibilityLabel="Registrar movimiento"
            className="h-12 w-12 -mt-4 items-center justify-center rounded-full bg-z-brass"
            style={{
              shadowColor: COLORS.brass,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.4,
              shadowRadius: 16,
              elevation: 8,
            }}
          >
            <Plus size={20} color={COLORS.ink} strokeWidth={2.5} />
          </Pressable>
        </View>

        <View className="flex-1 flex-row items-center justify-around">
          {RIGHT_TABS.map((tab) => {
            const routeIndex = state.routes.findIndex(
              (r) => r.name === tab.name
            );
            return (
              <TabButton
                key={tab.name}
                tab={tab}
                active={state.index === routeIndex}
                onPress={() => navigation.navigate(tab.name)}
              />
            );
          })}
        </View>
      </View>
    </View>
    </>
  );
}
