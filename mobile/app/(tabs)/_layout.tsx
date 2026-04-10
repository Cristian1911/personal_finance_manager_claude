import { Tabs } from "expo-router";
import { MobileTabBar } from "../../components/ui/MobileTabBar";

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <MobileTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="transactions" />
      <Tabs.Screen name="plan" />
      <Tabs.Screen name="deudas" />
      {/* Hidden tabs — kept as files but not in tab bar */}
      <Tabs.Screen name="import" options={{ href: null }} />
      <Tabs.Screen name="accounts" options={{ href: null }} />
      <Tabs.Screen name="budgets" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
