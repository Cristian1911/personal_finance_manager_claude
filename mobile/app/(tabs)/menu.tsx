import { View, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import {
  Wallet,
  Upload,
  Settings,
  PiggyBank,
  Repeat,
  Users,
} from "lucide-react-native";
import { MobileHeader } from "../../components/ui/MobileHeader";
import { HubEntry } from "../../components/ui/HubEntry";

export default function MenuScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-background">
      <MobileHeader variant="sub" title="Todo" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 40 }}
      >
        <HubEntry
          icon={Wallet}
          title="Cuentas"
          hint="Administrar cuentas bancarias"
          onPress={() => router.push("/accounts-list" as any)}
        />
        <HubEntry
          icon={Upload}
          title="Importar extracto"
          hint="Subir PDF de tu banco"
          onPress={() => router.push("/(tabs)/import" as any)}
        />
        <HubEntry
          icon={PiggyBank}
          title="Presupuestos"
          hint="Control mensual por categoría"
          onPress={() => router.push("/(tabs)/plan" as any)}
        />
        <HubEntry
          icon={Repeat}
          title="Suscripciones"
          hint="Pagos recurrentes"
          onPress={() => router.push("/subscriptions" as any)}
        />
        <HubEntry
          icon={Users}
          title="Personas"
          hint="Deudas con amigos y familia"
          onPress={() => router.push("/personas" as any)}
        />
        <HubEntry
          icon={Settings}
          title="Ajustes"
          hint="Perfil, sincronización, seguridad"
          onPress={() => router.push("/settings" as any)}
        />
      </ScrollView>
    </View>
  );
}
