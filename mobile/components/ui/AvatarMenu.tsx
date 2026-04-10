import { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Settings,
  Upload,
  Wallet,
  Menu,
  X,
} from "lucide-react-native";
import { useRouter } from "expo-router";
import { useAppStore } from "../../lib/store";
import { useAuth } from "../../lib/auth";
import { COLORS } from "../../lib/constants/colors";

function getInitials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) {
    return email.slice(0, 2).toUpperCase();
  }
  return "ZT";
}

export function AvatarMenuTrigger() {
  const [open, setOpen] = useState(false);
  const { profile } = useAppStore();
  const { session } = useAuth();

  const name = profile?.full_name ?? null;
  const email = session?.user?.email ?? null;
  const initials = getInitials(name, email);

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        className="h-8 w-8 items-center justify-center rounded-full border border-z-brass-30 bg-z-brass-10"
        accessibilityLabel="Menu de perfil"
      >
        <Text className="text-[10px] font-inter-semibold text-z-brass">
          {initials}
        </Text>
      </Pressable>

      <AvatarMenuSheet
        open={open}
        onClose={() => setOpen(false)}
        name={name}
        email={email}
      />
    </>
  );
}

function AvatarMenuSheet({
  open,
  onClose,
  name,
  email,
}: {
  open: boolean;
  onClose: () => void;
  name: string | null;
  email: string | null;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const navigate = useCallback(
    (path: string) => {
      onClose();
      // Small delay to let the modal close before navigation
      setTimeout(() => router.push(path as any), 150);
    },
    [onClose, router]
  );

  return (
    <Modal
      visible={open}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <Pressable className="flex-1 bg-black-40" onPress={onClose} />
      <View
        className="bg-z-surface-2 rounded-t-2xl border-t border-white-6"
        style={{ paddingBottom: insets.bottom + 8 }}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 pt-4 pb-3">
          <View>
            <Text className="text-sm font-inter-medium text-foreground">
              {name ?? "Usuario"}
            </Text>
            {email && (
              <Text className="mt-0.5 text-[11px] font-inter text-muted-foreground">
                {email}
              </Text>
            )}
          </View>
          <Pressable
            onPress={onClose}
            className="h-8 w-8 items-center justify-center rounded-full"
            accessibilityLabel="Cerrar"
          >
            <X size={18} color={COLORS.sageDark} />
          </Pressable>
        </View>

        <View className="h-px bg-white-6 mx-4" />

        {/* Nav items */}
        <View className="py-2">
          <MenuRow
            icon={<Wallet size={16} color={COLORS.sageDark} />}
            label="Cuentas"
            onPress={() => navigate("/accounts-list")}
          />
          <MenuRow
            icon={<Upload size={16} color={COLORS.sageDark} />}
            label="Importar extracto"
            onPress={() => navigate("/(tabs)/import" as string)}
          />
          <MenuRow
            icon={<Settings size={16} color={COLORS.sageDark} />}
            label="Ajustes"
            onPress={() => navigate("/settings")}
          />
        </View>

        <View className="h-px bg-white-6 mx-4" />

        <View className="py-2">
          <MenuRow
            icon={<Menu size={16} color={COLORS.brass} />}
            label="Ver todo"
            brass
            onPress={() => navigate("/menu")}
          />
        </View>
      </View>
    </Modal>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  brass = false,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
  brass?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-2.5 px-4 py-2.5"
    >
      {icon}
      <Text
        className={`text-sm font-inter-medium ${brass ? "text-z-brass" : "text-fg-80"}`}
      >
        {label}
      </Text>
    </Pressable>
  );
}
