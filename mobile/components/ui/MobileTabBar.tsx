import { memo, useCallback, useMemo, useState } from "react";
import { Alert, View, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useKeyboardState } from "react-native-keyboard-controller";
import { Plus } from "lucide-react-native";
import { useRouter, usePathname } from "expo-router";
import { COLORS } from "../../lib/constants/colors";
import { FabMenuSheet, type FabMenuAction } from "./FabMenuSheet";
import {
  getMobileTabs,
  isFocusModePath,
  isMobileTabActive,
  type MobileTab,
  type NavFocus,
} from "../../lib/constants/mobile-nav";
import { useTabBarVisibility } from "../nav/TabBarVisibilityProvider";

interface TabBarProps {
  state: { routes: Array<{ name: string }>; index: number };
  navigation: { navigate: (name: string) => void };
}

const TabButton = memo(function TabButton({
  tab,
  active,
  onPress,
}: {
  tab: MobileTab;
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
});

interface MobileTabBarProps extends TabBarProps {
  /** User preference for the dynamic 3rd tab. Defaults to "PLAN". */
  navFocus?: NavFocus;
}

export function MobileTabBar({ state, navigation, navFocus }: MobileTabBarProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pathname = usePathname();
  const keyboardVisible = useKeyboardState((s) => s.isVisible);
  const { isHidden: contextHidden } = useTabBarVisibility();
  const [menuOpen, setMenuOpen] = useState(false);

  const navigate = useCallback(
    (name: string) => navigation.navigate(name),
    [navigation]
  );

  const tabs = useMemo(() => getMobileTabs(navFocus), [navFocus]);
  const leftTabs = useMemo(() => tabs.slice(0, 2), [tabs]);
  const rightTabs = useMemo(() => tabs.slice(2), [tabs]);

  const renderTab = useCallback(
    (tab: MobileTab) => {
      const routeIndex = state.routes.findIndex((r) => r.name === tab.name);
      const active =
        routeIndex >= 0
          ? state.index === routeIndex
          : isMobileTabActive(pathname, tab);
      return (
        <TabButton
          key={tab.name}
          tab={tab}
          active={active}
          onPress={() => navigate(tab.name)}
        />
      );
    },
    [state, pathname, navigate]
  );

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
        router.push("/capture-voice" as never);
        return;
      case "screenshot":
        router.push("/capture-screenshot" as never);
        return;
    }
  }

  if (keyboardVisible) return null;
  if (contextHidden || isFocusModePath(pathname)) return null;

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
            {leftTabs.map(renderTab)}
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
            {rightTabs.map(renderTab)}
          </View>
        </View>
      </View>
    </>
  );
}
