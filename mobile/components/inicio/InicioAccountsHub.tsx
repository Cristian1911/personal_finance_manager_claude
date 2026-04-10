import { useRouter } from "expo-router";
import { Wallet } from "lucide-react-native";
import { formatCurrency, type CurrencyCode } from "@zeta/shared";
import { HubEntry } from "../ui/HubEntry";

interface InicioAccountsHubProps {
  accountCount: number;
  netWorth: number;
  currency: CurrencyCode;
}

export function InicioAccountsHub({
  accountCount,
  netWorth,
  currency,
}: InicioAccountsHubProps) {
  const router = useRouter();

  return (
    <HubEntry
      icon={Wallet}
      title="Mis cuentas"
      hint={`${accountCount} activas · ${formatCurrency(netWorth, currency)}`}
      onPress={() => router.push("/accounts-list" as any)}
    />
  );
}
