import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from "@expo-google-fonts/inter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef } from "react";
import { Platform, View, Image, Text, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ChatProvider } from "@/context/ChatContext";
import { ListingsProvider } from "@/context/ListingsContext";
import { AuthProvider } from "@/context/AuthContext";
import { setupNotifications, addNotificationResponseListener } from "@/utils/notifications";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function WebLanding() {
  return (
    <View style={styles.webContainer}>
      <Image
        source={require("../assets/images/icon.png")}
        style={styles.webLogo}
        resizeMode="contain"
      />
      <Text style={styles.webName}>Trampaj.hr</Text>
      <Text style={styles.webSlogan}>Jedna trampa, dvije sretne strane!</Text>
      <Text style={styles.webSoon}>Uskoro dostupno</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  webContainer: {
    flex: 1,
    backgroundColor: "#08152E",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  webLogo: {
    width: 140,
    height: 140,
    borderRadius: 28,
  },
  webName: {
    color: "#38BDF8",
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  webSlogan: {
    color: "#F5C100",
    fontSize: 16,
    fontWeight: "500",
  },
  webSoon: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 13,
    marginTop: 8,
  },
});

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
  });

  const responseListener = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    setupNotifications();

    // Tap na notifikaciju → otvori chat
    responseListener.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as { listingId?: string };
      if (data?.listingId) {
        router.push(`/chat/${data.listingId}`);
      }
    });

    return () => {
      responseListener.current?.remove();
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  if (Platform.OS === "web") {
    return <WebLanding />;
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <ListingsProvider>
              <ChatProvider>
                <GestureHandlerRootView>
                  <KeyboardProvider>
                    <RootLayoutNav />
                  </KeyboardProvider>
                </GestureHandlerRootView>
              </ChatProvider>
            </ListingsProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
