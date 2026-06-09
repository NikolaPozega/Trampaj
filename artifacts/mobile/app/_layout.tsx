import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { Feather } from "@expo/vector-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack, SplashScreen } from "expo-router";
import * as Updates from "expo-updates";
import React, { useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ChatProvider } from "@/context/ChatContext";
import { ListingsProvider } from "@/context/ListingsContext";
import { AuthProvider } from "@/context/AuthContext";
import { setupNotifications, addNotificationResponseListener } from "@/utils/notifications";
import { initSentry } from "@/utils/sentry";
initSentry();

// Use expo-router's SplashScreen — it calls internalPreventAutoHideAsync() and
// internalMaybeHideAsync() which are the correct paired functions. Do NOT call
// the standalone expo-splash-screen package here as it uses a separate counter
// that can block the splash from hiding.

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerBackTitle: "Natrag" }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, presentation: "fullScreenModal" }} />
      <Stack.Screen name="intro" options={{ headerShown: false, presentation: "fullScreenModal", gestureEnabled: false }} />
      <Stack.Screen name="login" options={{ headerShown: false, presentation: "card" }} />
      <Stack.Screen name="verify-email" options={{ headerShown: false, presentation: "card" }} />
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
    ...Feather.font,
  });

  const responseListener = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    setupNotifications();

    responseListener.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as { listingId?: string };
      if (data?.listingId) {
        router.push(`/chat/${data.listingId}`);
      }
    });

    // OTA auto-check disabled — re-enable after stable build confirmed
    // if (Platform.OS !== "web" && !__DEV__) {
    //   Updates.checkForUpdateAsync()
    //     .then((check) => {
    //       if (check.isAvailable) {
    //         return Updates.fetchUpdateAsync().then(() => Updates.reloadAsync());
    //       }
    //     })
    //     .catch(() => {});
    // }

    return () => {
      responseListener.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hide();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    const t = setTimeout(() => SplashScreen.hide(), 3000);
    return () => clearTimeout(t);
  }, []);

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ListingsProvider>
              <ChatProvider>
                <GestureHandlerRootView style={{ flex: 1 }}>
                  <RootLayoutNav />
                </GestureHandlerRootView>
              </ChatProvider>
            </ListingsProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
