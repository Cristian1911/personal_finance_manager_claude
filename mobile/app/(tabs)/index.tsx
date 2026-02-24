import { View, Text } from "react-native";

import type { Account } from "@venti5/shared";

export default function HomeScreen() {
  // Type-check that the shared package resolves
  const _typeCheck: Account | undefined = undefined;
  void _typeCheck;

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
      <Text style={{ fontSize: 24, fontWeight: "bold" }}>Venti5</Text>
    </View>
  );
}
