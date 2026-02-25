import { Tabs } from "expo-router";
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  PiggyBank,
  Upload,
  Settings,
} from "lucide-react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#047857",
        tabBarInactiveTintColor: "#374151",
        tabBarStyle: { backgroundColor: "#F3F4F6", borderTopColor: "#D1D5DB" },
        headerStyle: { backgroundColor: "#F3F4F6" },
        headerTintColor: "#111827",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="accounts"
        options={{
          title: "Cuentas",
          tabBarIcon: ({ color, size }) => (
            <Wallet size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transacciones",
          tabBarIcon: ({ color, size }) => (
            <Receipt size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="budgets"
        options={{
          title: "Presupuestos",
          tabBarIcon: ({ color, size }) => (
            <PiggyBank size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="import"
        options={{
          title: "Importar",
          tabBarIcon: ({ color, size }) => (
            <Upload size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Ajustes",
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
