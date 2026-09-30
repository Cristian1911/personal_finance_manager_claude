import { useFonts } from "expo-font";
import { Geist_400Regular, Geist_500Medium, Geist_600SemiBold, Geist_700Bold, Geist_800ExtraBold } from "@expo-google-fonts/geist";
import { GeistMono_600SemiBold } from "@expo-google-fonts/geist-mono";
import { BricolageGrotesque_800ExtraBold } from "@expo-google-fonts/bricolage-grotesque";

/** The v2 type set (S5-1): Geist UI, Geist Mono eyebrows, Bricolage Grotesque for Nítido's number. Loaded only by v2 screens. */
export function useV2Fonts(): boolean {
  const [loaded, error] = useFonts({
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    Geist_800ExtraBold,
    GeistMono_600SemiBold,
    BricolageGrotesque_800ExtraBold,
  });
  // A font that fails to load falls back to the system font; never block the screen.
  return loaded || !!error;
}
