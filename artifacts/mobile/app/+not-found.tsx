import { router, Stack } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";
import { useColors } from "@/hooks/useColors";

export default function NotFoundScreen() {
  const colors = useColors();

  useEffect(() => {
    router.replace("/(tabs)");
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ flex: 1, backgroundColor: colors.background }} />
    </>
  );
}
