import { View, Text, Pressable, Alert } from "react-native";
import { useRouter } from "expo-router";
import {
  HandCoins,
  ArrowLeftRight,
  Plus,
  RefreshCw,
  Ellipsis,
  type LucideIcon,
} from "lucide-react-native";
import type { AccountRow } from "../../lib/repositories/accounts";
import { COLORS } from "../../lib/constants/colors";

type ActionType = "payment" | "transfer" | "add" | "reconcile" | "more";

type ActionDef = {
  key: string;
  label: string;
  icon: LucideIcon;
  type: ActionType;
};

function getActionsForType(accountType: string): ActionDef[] {
  switch (accountType) {
    case "CREDIT_CARD":
      return [
        { key: "pay", label: "Pagar", icon: HandCoins, type: "payment" },
        { key: "add", label: "Agregar", icon: Plus, type: "add" },
        { key: "reconcile", label: "Ajustar", icon: RefreshCw, type: "reconcile" },
        { key: "more", label: "Más", icon: Ellipsis, type: "more" },
      ];
    case "SAVINGS":
    case "CHECKING":
    case "CASH":
      return [
        { key: "transfer", label: "Transferir", icon: ArrowLeftRight, type: "transfer" },
        { key: "add", label: "Agregar", icon: Plus, type: "add" },
        { key: "reconcile", label: "Ajustar", icon: RefreshCw, type: "reconcile" },
        { key: "more", label: "Más", icon: Ellipsis, type: "more" },
      ];
    case "LOAN":
      return [
        { key: "pay", label: "Pagar", icon: HandCoins, type: "payment" },
        { key: "reconcile", label: "Ajustar", icon: RefreshCw, type: "reconcile" },
        { key: "more", label: "Más", icon: Ellipsis, type: "more" },
      ];
    case "INVESTMENT":
      return [
        { key: "reconcile", label: "Ajustar", icon: RefreshCw, type: "reconcile" },
        { key: "more", label: "Más", icon: Ellipsis, type: "more" },
      ];
    default:
      return [
        { key: "add", label: "Agregar", icon: Plus, type: "add" },
        { key: "reconcile", label: "Ajustar", icon: RefreshCw, type: "reconcile" },
        { key: "more", label: "Más", icon: Ellipsis, type: "more" },
      ];
  }
}

function ActionButton({
  icon: Icon,
  label,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="items-center gap-1"
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View className="h-10 w-10 items-center justify-center rounded-full bg-white-6 active:bg-white-12">
        <Icon size={16} color={COLORS.sageLight} />
      </View>
      <Text className="text-z-sage-dark font-inter text-[10px]">{label}</Text>
    </Pressable>
  );
}

type Props = {
  account: AccountRow;
  onEdit: () => void;
  onDelete: () => void;
};

const STUB_MESSAGES: Record<string, string> = {
  payment: "Pagos desde la cuenta llegarán pronto. Por ahora usa 'Agregar' para registrar una transacción.",
  transfer: "Transferencias entre cuentas llegarán pronto. Por ahora usa 'Agregar' en cada cuenta.",
  reconcile: "Ajuste de saldo llegará pronto. Por ahora edita la cuenta para corregir el balance manualmente.",
};

export function QuickActionsBar({ account, onEdit, onDelete }: Props) {
  const router = useRouter();
  const accountType = account.account_type ?? "OTHER";
  const accountId = account.id;
  const actions = getActionsForType(accountType);

  function handleStub(type: ActionType) {
    const msg = STUB_MESSAGES[type];
    if (msg) Alert.alert("Próximamente", msg);
  }

  function handleMore() {
    Alert.alert("Más opciones", undefined, [
      { text: "Editar", onPress: onEdit },
      { text: "Eliminar", style: "destructive", onPress: onDelete },
      { text: "Cancelar", style: "cancel" },
    ]);
  }

  function handlePress(action: ActionDef) {
    switch (action.type) {
      case "add":
        router.push(`/transactions/new?account=${accountId}`);
        return;
      case "more":
        handleMore();
        return;
      case "payment":
      case "transfer":
      case "reconcile":
        handleStub(action.type);
        return;
    }
  }

  return (
    <View className="flex-row items-start justify-center gap-6">
      {actions.map((action) => (
        <ActionButton
          key={action.key}
          icon={action.icon}
          label={action.label}
          onPress={() => handlePress(action)}
        />
      ))}
    </View>
  );
}
