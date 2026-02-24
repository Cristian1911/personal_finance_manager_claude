import { View, Text } from "react-native";

export default function HomeScreen() {
  return (
    <View className="flex-1 justify-center items-center bg-white">
      <Text className="text-3xl font-inter-bold text-gray-900">
        Venti<Text className="text-primary">5</Text>
      </Text>
      <Text className="text-base text-gray-500 mt-2 font-inter">
        Tus finanzas, claras.
      </Text>
    </View>
  );
}
