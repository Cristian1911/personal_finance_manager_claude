import { useState, useCallback } from "react";
import { View, Text, Pressable, Modal } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Settings,
  Upload,
  Wallet,
  Users,
  Tag,
  ChevronRight,
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
        accessibilityLabel="Menú de perfil"
      >
        <Text className="text-[10px] font-inter-semibold text-z-brass">
          {initials}
        </Text>
      </Pressable>

      <AvatarMenuPopover
        open={open}
        onClose={() => setOpen(false)}
        name={name}
        email={email}
      />
    </>
  );
}

function AvatarMenuPopover({
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
      setTimeout(() => router.push(path as never), 120);
    },
    [onClose, router]
  );

  return (
    <Modal
      visible={open}
      animationType="fade"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable className="flex-1" onPress={onClose}>
        <View
          style={{
            position: "absolute",
            top: insets.top + 48,
            right: 8,
            width: 288,
          }}
        >
          <Pressable
            onPress={(e) => e.stopPropagation()}
            className="rounded-2xl border border-white-6 bg-z-surface-2-80 overflow-hidden"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.35,
              shadowRadius: 24,
              elevation: 12,
            }}
          >
            {/* Header */}
            <View className="px-4 pt-4 pb-3">
              <Text
                className="text-base font-inter-bold text-foreground"
                numberOfLines={1}
              >
                {name ?? "Usuario"}
              </Text>
              {email && (
                <Text
                  className="mt-0.5 text-[12px] font-inter text-muted-foreground"
                  numberOfLines={1}
                >
                  {email}
                </Text>
              )}
            </View>

            <View className="h-px bg-z-surface-2-6 mx-4" />

            {/* Featured IMPORTAR card */}
            <View className="px-4 pt-3 pb-2">
              <Pressable
                onPress={() => navigate("/(tabs)/import" as string)}
                className="rounded-xl border border-z-brass-20 bg-z-brass-8 px-3 py-3 active:bg-z-brass-10"
              >
                <View className="flex-row items-start gap-2.5">
                  <View className="mt-0.5 h-8 w-8 items-center justify-center rounded-full bg-z-brass-20">
                    <Upload size={14} color={COLORS.brass} strokeWidth={2} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-center justify-between">
                      <Text className="text-[10px] font-inter-semibold uppercase tracking-[2px] text-z-brass">
                        Importar
                      </Text>
                      <ChevronRight size={14} color={COLORS.brass} />
                    </View>
                    <Text className="mt-1 text-[13px] font-inter-semibold text-foreground leading-snug">
                      Sube un extracto PDF o captura de pantalla
                    </Text>
                    <Text className="mt-2 text-[11px] font-inter-semibold text-z-brass">
                      Ir a importar
                    </Text>
                  </View>
                </View>
              </Pressable>
            </View>

            <View className="h-px bg-z-surface-2-6 mx-4 mt-2" />

            {/* Nav rows */}
            <View className="py-1">
              <MenuRow
                icon={<Users size={16} color={COLORS.sageDark} />}
                label="Destinatarios"
                onPress={() => navigate("/destinatarios")}
              />
              <MenuRow
                icon={<Tag size={16} color={COLORS.sageDark} />}
                label="Categorizar"
                onPress={() => navigate("/categorizar")}
              />
              <MenuRow
                icon={<Wallet size={16} color={COLORS.sageDark} />}
                label="Cuentas"
                onPress={() => navigate("/accounts-list")}
              />
              <MenuRow
                icon={<Settings size={16} color={COLORS.sageDark} />}
                label="Ajustes"
                onPress={() => navigate("/settings")}
              />
            </View>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className="flex-row items-center gap-3 px-4 py-3 active:bg-z-surface-2/5"
    >
      {icon}
      <Text className="flex-1 text-sm font-inter-medium text-foreground">
        {label}
      </Text>
    </Pressable>
  );
}
