import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MOBILE_TAB_BAR_CLEARANCE } from "../constants/styles";

/**
 * Returns the bottom padding (in px) every page-level scroll container should
 * apply so its content clears the floating tab bar + FAB overshoot + the
 * device safe-area inset. Use as `paddingBottom` on `contentContainerStyle`
 * (ScrollView/FlatList) or as `style.paddingBottom` on a fixed-height root.
 *
 * Mirrors webapp's `MOBILE_TAB_BAR_CLEARANCE_CLASS`.
 *
 * Sheet/Drawer content does NOT use this — sheets float above the tab bar,
 * so they only need `insets.bottom`.
 */
export function useTabBarClearance(): number {
  const insets = useSafeAreaInsets();
  return MOBILE_TAB_BAR_CLEARANCE + insets.bottom;
}
