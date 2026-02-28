import { Pressable, Text } from "react-native";
import { useRouter } from "expo-router";
import { Plus } from "lucide-react-native";

export function FloatingCaptureButton() {
  const router = useRouter();

  return (
    <Pressable
      onPress={() => router.push("/capture" as any)}
      className="absolute bottom-6 right-4 flex-row items-center rounded-full bg-primary px-4 py-3 shadow-lg active:bg-emerald-700"
    >
      <Plus size={18} color="#FFFFFF" />
      <Text className="ml-2 font-inter-semibold text-white">Registrar</Text>
    </Pressable>
  );
}
