import { View } from "react-native";
import { MobileHeader } from "../components/ui/MobileHeader";

// The accounts list content will be extracted from (tabs)/accounts.tsx
// and reskinned in Phase 7. For now, this is the stack screen shell.

export default function AccountsListScreen() {
  return (
    <View className="flex-1 bg-background">
      <MobileHeader variant="sub" title="Mis cuentas" />
    </View>
  );
}
