import "../global.css";

import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";
import { Stack, useRootNavigationState, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "react-native-reanimated";

import { useColorScheme } from "@/components/useColorScheme";
import { AuthProvider, useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { BugReportProvider } from "../lib/bugReportMode";
import { BugFAB } from "../components/BugFAB";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <BugReportProvider>
        <RootLayoutNav />
      </BugReportProvider>
    </AuthProvider>
  );
}

function buildSheetOptions(detents: [number, number]) {
  if (Platform.OS !== "ios") {
    return {
      presentation: "modal" as const,
      headerShown: false,
    };
  }

  return {
    presentation: "formSheet" as const,
    headerShown: false,
    sheetAllowedDetents: detents,
    sheetInitialDetentIndex: 0,
    sheetGrabberVisible: true,
  };
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { session, loading, demoMode } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkOnboarding() {
      if (loading) return;
      if (demoMode) {
        if (!mounted) return;
        setNeedsOnboarding(false);
        setCheckingOnboarding(false);
        return;
      }
      if (!session) {
        if (!mounted) return;
        setNeedsOnboarding(false);
        setCheckingOnboarding(false);
        return;
      }

      setCheckingOnboarding(true);
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!mounted) return;
      setNeedsOnboarding(!data?.onboarding_completed);
      setCheckingOnboarding(false);
    }

    checkOnboarding();

    return () => {
      mounted = false;
    };
  }, [loading, session, demoMode]);

  useEffect(() => {
    if (!rootNavigationState?.key) return;
    if (loading || checkingOnboarding) return;

    const firstSegment = (segments[0] as string) ?? "";
    const inAuthGroup = firstSegment === "(auth)";
    const inOnboarding = firstSegment === "onboarding";

    if (!session && !demoMode && !inAuthGroup) {
      router.replace("/(auth)/login");
      return;
    }

    if (!session && demoMode) {
      if (inAuthGroup || inOnboarding) {
        router.replace("/(tabs)");
      }
      return;
    }

    if (!session) return;

    if (needsOnboarding && !inOnboarding) {
      router.replace("/onboarding" as never);
      return;
    }

    if (!needsOnboarding && (inAuthGroup || inOnboarding)) {
      router.replace("/(tabs)");
    }
  }, [session, demoMode, loading, checkingOnboarding, needsOnboarding, segments, router, rootNavigationState?.key]);

  const isLoading = loading || checkingOnboarding;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen
            name="transaction/[id]"
            options={buildSheetOptions([0.72, 1.0])}
          />
          <Stack.Screen
            name="account/[id]"
            options={buildSheetOptions([0.72, 1.0])}
          />
          <Stack.Screen
            name="account/create"
            options={buildSheetOptions([0.72, 1.0])}
          />
          <Stack.Screen
            name="account/edit/[id]"
            options={{
              presentation: "card",
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="bug-report"
            options={buildSheetOptions([0.6, 0.95])}
          />
          <Stack.Screen
            name="subscriptions"
            options={buildSheetOptions([0.65, 1.0])}
          />
          <Stack.Screen
            name="capture"
            options={{
              presentation: "formSheet",
              headerShown: false,
              sheetAllowedDetents: [0.72, 1.0],
              sheetInitialDetentIndex: 0,
              sheetGrabberVisible: true,
            }}
          />
        </Stack>
        <BugFAB />
        {isLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#047857" />
          </View>
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
});
