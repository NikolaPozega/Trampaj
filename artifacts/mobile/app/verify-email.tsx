import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

const API_BASE = process.env["EXPO_PUBLIC_DOMAIN"]
  ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`
  : "/api";

export default function VerifyEmailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useLocalSearchParams<{ token: string }>();
  const { login } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [jwtToken, setJwtToken] = useState<string | null>(null);

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Nevažeći link za verifikaciju.");
      return;
    }

    fetch(`${API_BASE}/auth/verify/${token}`)
      .then((r) => r.json())
      .then((data: { message?: string; token?: string; error?: string }) => {
        if (data.error) {
          setStatus("error");
          setMessage(data.error);
        } else {
          setStatus("success");
          setMessage(data.message ?? "Email potvrđen!");
          if (data.token) setJwtToken(data.token);
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Greška pri verifikaciji. Pokušaj ponovo.");
      });
  }, [token]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.replace("/(tabs)")}
          style={({ pressed }) => [styles.back, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.foreground }]}>Verifikacija emaila</Text>
        <View style={{ width: 36 }} />
      </View>

      <View style={styles.content}>
        {status === "loading" && (
          <>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.statusText, { color: colors.mutedForeground }]}>
              Verifikacija u tijeku...
            </Text>
          </>
        )}

        {status === "success" && (
          <>
            <View style={[styles.iconCircle, { backgroundColor: "#1A3A2A" }]}>
              <Feather name="check-circle" size={48} color="#4ADE80" />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>Email potvrđen!</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
              Tvoj profil je sada aktivan. Možeš se prijaviti.
            </Text>
            <Pressable
              onPress={() => router.replace("/login")}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Prijavi se</Text>
            </Pressable>
          </>
        )}

        {status === "error" && (
          <>
            <View style={[styles.iconCircle, { backgroundColor: "#3A1A1A" }]}>
              <Feather name="x-circle" size={48} color="#F87171" />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>Greška</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{message}</Text>
            <Pressable
              onPress={() => router.replace("/login")}
              style={({ pressed }) => [
                styles.btn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Idi na prijavu</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, justifyContent: "space-between", borderBottomWidth: 1 },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  iconCircle: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center" },
  subtitle: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  statusText: { fontSize: 15, fontFamily: "Inter_400Regular" },
  btn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12, marginTop: 8 },
  btnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
});
