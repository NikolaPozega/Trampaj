import { useEffect } from "react";
import { View } from "react-native";
import { router } from "expo-router";

export default function NotFoundScreen() {
  useEffect(() => {
    const t = setTimeout(() => {
      router.replace("/(tabs)");
    }, 50);
    return () => clearTimeout(t);
  }, []);

  return <View style={{ flex: 1, backgroundColor: "#08152E" }} />;
}
