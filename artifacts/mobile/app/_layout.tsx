import { Stack } from "expo-router";
import React from "react";
import { View, Text } from "react-native";

export default function RootLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: "#08152E", alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#F5C100", fontSize: 24, fontWeight: "bold" }}>
        Trampaj.hr — Radi! ✓
      </Text>
      <Text style={{ color: "#38BDF8", fontSize: 14, marginTop: 8 }}>
        Konekcija OK
      </Text>
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
