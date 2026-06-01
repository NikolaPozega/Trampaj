import { router, Stack } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";

import { useColors } from "@/hooks/useColors";

export default function NotFoundScreen() {
  const colors = useColors();

  useEffect(() => {
    router.replace("/(tabs)");
  }, []);

  return (
    <>
      <Stack.Screen options={{ title: "Ups!" }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.title, { color: colors.foreground }]}>
          Ovaj ekran ne postoji.
        </Text>
        <Pressable onPress={() => router.replace("/")} style={styles.link}>
          <Text style={[styles.linkText, { color: colors.primary }]}>
            Idi na početni zaslon!
          </Text>
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
  },
});
