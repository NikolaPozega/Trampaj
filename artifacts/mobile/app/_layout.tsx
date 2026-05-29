import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { View, Text } from "react-native";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: "#08152E" }}>
      <View style={{ position: "absolute", top: 80, left: 0, right: 0, alignItems: "center", zIndex: 999 }}>
        <Text style={{ color: "#F5C100", fontSize: 22, fontWeight: "bold" }}>
          Trampaj.hr TEST
        </Text>
        <Text style={{ color: "#38BDF8", fontSize: 14, marginTop: 6 }}>
          Konekcija radi ✓
        </Text>
      </View>
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
