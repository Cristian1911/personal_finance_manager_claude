import { useState } from "react";
import { Platform, View, Text, TouchableOpacity, ActivityIndicator } from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { signInWithApple, signInWithGoogle } from "../../lib/auth-social";
import { COLORS } from "../../lib/constants/colors";

/**
 * Google + Apple sign-in buttons for the mobile auth screens. On success the
 * onAuthStateChange listener in auth.tsx navigates; this only reports errors.
 * Apple uses the native HIG button on iOS, a custom dark button on Android.
 */
export function SocialAuthButtons({
  onError,
}: {
  onError: (message: string | null) => void;
}) {
  const [busy, setBusy] = useState<null | "google" | "apple">(null);

  async function run(provider: "google" | "apple") {
    onError(null);
    setBusy(provider);
    const { error } =
      provider === "google" ? await signInWithGoogle() : await signInWithApple();
    if (error) onError(error);
    setBusy(null);
  }

  return (
    <View className="gap-3">
      <View className="flex-row items-center gap-3">
        <View className="h-px flex-1 bg-white-6" />
        <Text className="text-xs text-muted-foreground">o continúa con</Text>
        <View className="h-px flex-1 bg-white-6" />
      </View>

      <TouchableOpacity
        className="flex-row items-center justify-center gap-2 rounded-lg border border-white-6 bg-z-surface-2-55 py-3.5"
        onPress={() => run("google")}
        disabled={busy !== null}
        activeOpacity={0.8}
      >
        {busy === "google" ? (
          <ActivityIndicator color={COLORS.sageDark} />
        ) : (
          <Text className="text-foreground font-semibold text-base">
            Continuar con Google
          </Text>
        )}
      </TouchableOpacity>

      {Platform.OS === "ios" ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
          cornerRadius={8}
          style={{ height: 50 }}
          onPress={() => run("apple")}
        />
      ) : (
        // Apple HIG: non-iOS fallback must be a white button with dark text.
        // bg-white (pure #FFFFFF) is brand-mandated here, not a Zeta token.
        <TouchableOpacity
          className="flex-row items-center justify-center gap-2 rounded-lg bg-white py-3.5"
          onPress={() => run("apple")}
          disabled={busy !== null}
          activeOpacity={0.8}
        >
          {busy === "apple" ? (
            <ActivityIndicator color={COLORS.ink} />
          ) : (
            <Text className="text-z-ink font-semibold text-base"> Continuar con Apple</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}
