import { View, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardController } from "react-native-keyboard-controller";
import { Plus } from "lucide-react-native";
import { useRouter } from "expo-router";
import { COLORS } from "../../lib/constants/colors";
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

export function MobileTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { enabled: keyboardVisible } = useKeyboardController();

  // Hide tab bar when keyboard is open
  if (keyboardVisible) return null;

  return (
    <View
      className="border-t border-white-6 bg-background-92"
      style={{ paddingBottom: insets.bottom }}
    >
      <View className="flex-row items-center h-14">
        {/* Left tabs */}
        <View className="flex-1 flex-row items-center justify-around">
          {LEFT_TABS.map((tab) => {
            const routeIndex = state.routes.findIndex(
              (r) => r.name === tab.name
            );
            const active = state.index === routeIndex;
            return (
              <Pressable
                key={tab.name}
                onPress={() => navigation.navigate(tab.name)}
                className="flex-1 items-center gap-0.5 py-2.5"
                accessibilityLabel={tab.title}
                accessibilityState={{ selected: active }}
              >
                <tab.icon size={20} color={active ? COLORS.brass : COLORS.sageDark} />
                <Text
                  className={`text-[11px] font-inter-medium ${active ? "text-z-brass" : "text-muted-fg-70"}`}
                >
                  {tab.title}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Center FAB */}
        <View className="items-center justify-center px-4">
          <Pressable
            onPress={() => router.push("/capture" as any)}
            className="h-12 w-12 -mt-4 items-center justify-center rounded-full bg-z-brass"
            style={{
              shadowColor: "rgba(147,120,68,0.4)",
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 1,
              shadowRadius: 16,
              elevation: 8,
            }}
            accessibilityLabel="Registrar movimiento"
          >
            <Plus size={20} color={COLORS.ink} strokeWidth={2.5} />
          </Pressable>
        </View>

        {/* Right tabs */}
        <View className="flex-1 flex-row items-center justify-around">
          {RIGHT_TABS.map((tab) => {
            const routeIndex = state.routes.findIndex(
              (r) => r.name === tab.name
            );
            const active = state.index === routeIndex;
            return (
              <Pressable
                key={tab.name}
                onPress={() => navigation.navigate(tab.name)}
                className="flex-1 items-center gap-0.5 py-2.5"
                accessibilityLabel={tab.title}
                accessibilityState={{ selected: active }}
              >
                <tab.icon size={20} color={active ? COLORS.brass : COLORS.sageDark} />
                <Text
                  className={`text-[11px] font-inter-medium ${active ? "text-z-brass" : "text-muted-fg-70"}`}
                >
                  {tab.title}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}
