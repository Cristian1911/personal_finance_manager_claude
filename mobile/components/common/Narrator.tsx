import { View, Text } from "react-native";

type Props = {
  children: string;
  tone?: "brass" | "sage";
  spacing?: "default" | "tight";
};

/**
 * Narrator — handwritten-voice annotation.
 * For conversational, low-stakes guidance: "Sin sorpresas, dale.", "1 ambiguo — son solo unos toques."
 * Never for errors or critical copy.
 *
 * Visually: centered, brighter than surrounding copy, off-rhythm from the grid.
 * Should read as if someone scribbled a note in the margin — intentional, not shy.
 */
export function Narrator({ children, tone = "brass", spacing = "default" }: Props) {
  const color = tone === "sage" ? "text-z-sage-light" : "text-z-brass";
  const mtCls = spacing === "tight" ? "mt-4" : "mt-8";
  return (
    <View className={`${mtCls} items-center px-4`}>
      <Text
        className={`text-center font-narrator text-[24px] leading-[30px] ${color}`}
      >
        {children}
      </Text>
    </View>
  );
}
