import { View } from "react-native";
import { MobileHeader } from "../components/ui/MobileHeader";

// The settings content will be extracted from (tabs)/settings.tsx
// and reskinned in Phase 7. For now, this is the stack screen shell.
// The actual settings tab is hidden (href: null) and this stack screen
// is accessible via the avatar menu.

export default function SettingsStackScreen() {
  return (
    <View className="flex-1 bg-background">
      <MobileHeader variant="sub" title="Ajustes" />
    </View>
  );
}
