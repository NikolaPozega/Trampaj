import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { useListings } from "@/context/ListingsContext";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login } = useAuth();
  const { setMyName } = useListings();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notVerified, setNotVerified] = useState(false);
  const [notVerifiedEmail, setNotVerifiedEmail] = useState("");

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;

  async function handleLogin() {
    if (!username.trim()) { setError("Upiši korisničko ime"); return; }
    if (!password) { setError("Upiši lozinku"); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLoading(true);
    setError("");
    setNotVerified(false);

    const result = await login(username.trim(), password);
    setLoading(false);

    if (result.ok) {
      // Sync name to ListingsContext so sample listings show correct name
      await setMyName(username.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } else if (result.notVerified) {
      setNotVerified(true);
      setNotVerifiedEmail(result.email ?? "");
    } else {
      setError(result.error ?? "Greška pri prijavi");
    }
  }

  function handleSocial() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.replace("/(tabs)");
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <View style={styles.topTabs}>
          <View style={[styles.topTab, styles.topTabActive, { borderBottomColor: colors.primary }]}>
            <Text style={[styles.topTabText, { color: colors.primary }]}>Prijava</Text>
          </View>
          <Pressable onPress={() => router.push("/onboarding")} style={styles.topTab}>
            <Text style={[styles.topTabText, { color: colors.mutedForeground }]}>Registracija</Text>
          </Pressable>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleSection}>
          <Text style={[styles.title, { color: colors.foreground }]}>Prijava</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            Još nemaš profil na Trampaj.hr?{" "}
            <Text style={[styles.link, { color: colors.secondary }]} onPress={() => router.push("/onboarding")}>
              Registriraj se »
            </Text>
          </Text>
        </View>

        {/* Not-verified notice */}
        {notVerified && (
          <View style={[styles.noticeBox, { backgroundColor: `${colors.primary}18`, borderColor: `${colors.primary}40` }]}>
            <Feather name="mail" size={16} color={colors.primary} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.noticeTitle, { color: colors.primary }]}>Email nije potvrđen</Text>
              <Text style={[styles.noticeText, { color: colors.mutedForeground }]}>
                Provjeri inbox na {notVerifiedEmail} i klikni link za aktivaciju profila.
              </Text>
              <Pressable
                onPress={async () => {
                  const API_BASE = process.env["EXPO_PUBLIC_DOMAIN"]
                    ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`
                    : "/api";
                  await fetch(`${API_BASE}/auth/resend-verification`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: notVerifiedEmail }),
                  });
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                }}
              >
                <Text style={[styles.resendLink, { color: colors.secondary }]}>Pošalji ponovo →</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Form */}
        <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.mutedForeground }]}>Korisničko ime</Text>
            <TextInput
              value={username}
              onChangeText={(v) => { setUsername(v); setError(""); }}
              placeholder="npr. Marko.Z"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted }]}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
            />
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Lozinka</Text>
              <Pressable>
                <Text style={[styles.forgotLink, { color: colors.secondary }]}>Zaboravio lozinku?</Text>
              </Pressable>
            </View>
            <View style={[styles.passwordWrap, { borderColor: colors.border, backgroundColor: colors.muted }]}>
              <TextInput
                value={password}
                onChangeText={(v) => { setPassword(v); setError(""); }}
                placeholder="Lozinka"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.passwordInput, { color: colors.foreground }]}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                <Feather name={showPassword ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
              </Pressable>
            </View>
          </View>

          <Pressable onPress={() => setRememberMe((v) => !v)} style={styles.rememberRow}>
            <View style={[styles.checkbox, {
              backgroundColor: rememberMe ? colors.primary : colors.muted,
              borderColor: rememberMe ? colors.primary : colors.border,
            }]}>
              {rememberMe && <Feather name="check" size={11} color={colors.primaryForeground} />}
            </View>
            <Text style={[styles.rememberText, { color: colors.foreground }]}>Zapamti me</Text>
          </Pressable>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: `${colors.destructive}18`, borderColor: `${colors.destructive}40` }]}>
              <Feather name="alert-circle" size={14} color={colors.destructive} />
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
          ) : null}

          <Pressable
            onPress={handleLogin}
            disabled={loading}
            style={({ pressed }) => [styles.submitBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.submitBtnText, { color: colors.primaryForeground }]}>
              {loading ? "Prijavljivanje..." : "PRIJAVI SE"}
            </Text>
          </Pressable>
        </View>

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>ili nastavi s</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* Social buttons */}
        <View style={styles.socialButtons}>
          <Pressable
            onPress={handleSocial}
            style={({ pressed }) => [styles.socialBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={styles.googleG}>G</Text>
            <Text style={[styles.socialBtnText, { color: colors.foreground }]}>Nastavi s Google računom</Text>
          </Pressable>
          <Pressable
            onPress={handleSocial}
            style={({ pressed }) => [styles.socialBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
          >
            <Feather name="smartphone" size={18} color={colors.foreground} />
            <Text style={[styles.socialBtnText, { color: colors.foreground }]}>Nastavi s Apple računom</Text>
          </Pressable>
          <Pressable
            onPress={handleSocial}
            style={({ pressed }) => [styles.socialBtn, { backgroundColor: "#1877F2", borderColor: "#1877F2", opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={styles.fbF}>f</Text>
            <Text style={[styles.socialBtnText, { color: "#fff" }]}>Nastavi s Facebook računom</Text>
          </Pressable>
        </View>

        <Pressable
          onPress={() => router.replace("/(tabs)")}
          style={({ pressed }) => [styles.guestBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[styles.guestText, { color: colors.mutedForeground }]}>Nastavi bez prijave →</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 0, justifyContent: "space-between", borderBottomWidth: 1 },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  topTabs: { flexDirection: "row", flex: 1, justifyContent: "center" },
  topTab: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: "transparent" },
  topTabActive: {},
  topTabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  scroll: { padding: 20, gap: 20 },
  titleSection: { gap: 6 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  link: { fontFamily: "Inter_600SemiBold" },
  noticeBox: { flexDirection: "row", gap: 12, borderWidth: 1, borderRadius: 12, padding: 14 },
  noticeTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  noticeText: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  resendLink: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  formCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 14 },
  field: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  labelRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  forgotLink: { fontSize: 12, fontFamily: "Inter_400Regular" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontFamily: "Inter_400Regular" },
  passwordWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 4 },
  passwordInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", paddingVertical: 9 },
  rememberRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  rememberText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, padding: 10 },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  submitBtn: { paddingVertical: 15, borderRadius: 10, alignItems: "center", marginTop: 2 },
  submitBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  dividerLine: { flex: 1, height: 1 },
  dividerText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  socialButtons: { gap: 10 },
  socialBtn: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 10, borderWidth: 1 },
  socialBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1, textAlign: "center" },
  googleG: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#4285F4", width: 20, textAlign: "center" },
  fbF: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff", width: 20, textAlign: "center" },
  guestBtn: { alignItems: "center", paddingVertical: 8 },
  guestText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
