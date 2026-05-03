import { View } from "react-native";
import { Tabs } from "expo-router";
import { MobileTabBar } from "../../components/ui/MobileTabBar";
import { TabBarVisibilityProvider } from "../../components/nav/TabBarVisibilityProvider";
import { FocusModeAccent } from "../../components/nav/FocusModeAccent";

export default function TabLayout() {
  return (
    <TabBarVisibilityProvider>
      <View style={{ flex: 1 }}>
        <FocusModeAccent />
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
          <Tabs.Screen name="menu" />
          {/* Hidden tabs — kept as files but not in tab bar */}
          <Tabs.Screen name="import" options={{ href: null }} />
          <Tabs.Screen name="accounts" options={{ href: null }} />
          <Tabs.Screen name="budgets" options={{ href: null }} />
        </Tabs>
      </View>
    </TabBarVisibilityProvider>
  );
}
