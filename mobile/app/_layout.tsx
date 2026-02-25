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
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import "react-native-reanimated";

import { useColorScheme } from "@/components/useColorScheme";
import { AuthProvider, useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

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
      <RootLayoutNav />
    </AuthProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function checkOnboarding() {
      if (loading) return;
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
  }, [loading, session]);

  useEffect(() => {
    if (loading || checkingOnboarding) return;

    const firstSegment = (segments[0] as string) ?? "";
    const inAuthGroup = firstSegment === "(auth)";
    const inOnboarding = firstSegment === "onboarding";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/login");
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
  }, [session, loading, checkingOnboarding, needsOnboarding, segments, router]);

  if (loading || checkingOnboarding) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen
          name="transaction/[id]"
          options={{
            presentation: "modal",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="account/[id]"
          options={{
            presentation: "modal",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="account/create"
          options={{
            presentation: "modal",
            headerShown: false,
          }}
        />
        <Stack.Screen
          name="account/edit/[id]"
          options={{
            presentation: "card",
            headerShown: false,
          }}
        />
      </Stack>
    </ThemeProvider>
  );
}
