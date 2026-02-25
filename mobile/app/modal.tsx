import { StatusBar } from "expo-status-bar";
import { Platform, View, Text } from "react-native";

export default function ModalScreen() {
  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text>Modal</Text>
      <StatusBar style={Platform.OS === "ios" ? "light" : "auto"} />
    </View>
  );
}
