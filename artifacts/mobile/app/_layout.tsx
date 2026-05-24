import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ChatProvider } from "@/context/ChatContext";
import { ListingsProvider } from "@/context/ListingsContext";
import { ONBOARDED_KEY } from "@/app/onboarding";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function RootLayoutNav({ isOnboarded }: { isOnboarded: boolean }) {
  useEffect(() => {
    if (!isOnboarded) {
      router.replace("/onboarding");
    }
  }, [isOnboarded]);

  return (
    <Stack screenOptions={{ headerBackTitle: "Natrag" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, presentation: "fullScreenModal" }} />
      <Stack.Screen name="listing/[id]" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="chat/[listingId]" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="user/[name]" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="privacy" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="terms" options={{ headerShown: false, presentation: "card" }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [isOnboarded, setIsOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDED_KEY).then((val) => {
      setIsOnboarded(val === "1");
    });
  }, []);

  useEffect(() => {
    if ((fontsLoaded || fontError) && isOnboarded !== null) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError, isOnboarded]);

  if ((!fontsLoaded && !fontError) || isOnboarded === null) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <ListingsProvider>
            <ChatProvider>
              <GestureHandlerRootView>
                <KeyboardProvider>
                  <RootLayoutNav isOnboarded={isOnboarded} />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </ChatProvider>
          </ListingsProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
