import { View } from "react-native";
import { usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { isFocusModePath } from "../../lib/constants/mobile-nav";
import { useTabBarVisibility } from "./TabBarVisibilityProvider";

/**
 * 2px brass strip pinned to the top safe-area edge whenever the tab bar is
 * hidden via focus mode. Acts as the visual cue that the current screen is a
 * single-task surface — without it, the disappearing tab bar reads like a
 * glitch. Mounted once in `(tabs)/_layout.tsx`.
 */
export function FocusModeAccent() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isHidden: contextHidden } = useTabBarVisibility();
  const focused = contextHidden || isFocusModePath(pathname);

  if (!focused) return null;

  return (
    <View
      pointerEvents="none"
      className="absolute left-0 right-0 z-10 h-0.5 bg-z-brass"
      style={{ top: insets.top }}
    />
  );
}
