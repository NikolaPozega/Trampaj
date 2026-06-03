import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
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

const FALLBACK_DOMAIN = "trampaj.hr";
const API_BASE = `https://${process.env["EXPO_PUBLIC_DOMAIN"] ?? FALLBACK_DOMAIN}/api`;

export default function ResetPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token } = useLocalSearchParams<{ token?: string }>();
  const { login } = useAuth();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;

  async function handleReset() {
    if (!token) {
      setError("Nevažeći link za reset.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Lozinka mora imati najmanje 6 znakova.");
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError("Lozinka mora sadržavati najmanje jedno veliko slovo.");
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setError("Lozinka mora sadržavati najmanje jedan broj.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Lozinke se ne podudaraju.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Greška pri resetiranju.");
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setDone(true);
    } catch {
      setError("Greška pri povezivanju s poslužiteljem.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.topBar, { paddingTop: topPad, borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable
          onPress={() => router.replace("/login")}
          style={({ pressed }) => [styles.backCircle, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.topTitle, { color: colors.foreground }]}>Nova lozinka</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]} keyboardShouldPersistTaps="handled">
        {done ? (
          <View style={styles.doneBox}>
            <View style={[styles.doneIcon, { backgroundColor: "#1a7a4a" }]}>
              <Feather name="check" size={36} color="#fff" />
            </View>
            <Text style={[styles.doneTitle, { color: colors.foreground }]}>Lozinka promijenjena!</Text>
            <Text style={[styles.doneSub, { color: colors.mutedForeground }]}>
              Možeš se sada prijaviti s novom lozinkom.
            </Text>
            <Pressable
              onPress={() => router.replace("/login")}
              style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Idi na prijavu</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            {!token && (
              <View style={[styles.errorBox, { backgroundColor: colors.destructive + "22", borderColor: colors.destructive + "44" }]}>
                <Feather name="alert-triangle" size={16} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>
                  Nevažeći ili istekli link za reset lozinke.
                </Text>
              </View>
            )}

            <Text style={[styles.desc, { color: colors.mutedForeground }]}>
              Upiši novu lozinku. Mora imati najmanje 6 znakova.
            </Text>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Nova lozinka</Text>
              <View style={[styles.passwordWrap, { borderColor: error.includes("znakova") || error.includes("podudaraju") ? colors.destructive : colors.border, backgroundColor: colors.muted }]}>
                <TextInput
                  value={newPassword}
                  onChangeText={(t) => { setNewPassword(t); setError(""); }}
                  placeholder="Min. 6 znakova"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showNew}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[styles.passwordInput, { color: colors.foreground }]}
                />
                <Pressable onPress={() => setShowNew((v) => !v)} hitSlop={8}>
                  <Feather name={showNew ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.mutedForeground }]}>Ponovi lozinku</Text>
              <View style={[styles.passwordWrap, { borderColor: error.includes("podudaraju") ? colors.destructive : colors.border, backgroundColor: colors.muted }]}>
                <TextInput
                  value={confirmPassword}
                  onChangeText={(t) => { setConfirmPassword(t); setError(""); }}
                  placeholder="Ponovi novu lozinku"
                  placeholderTextColor={colors.mutedForeground}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  autoCorrect={false}
                  returnKeyType="done"
                  onSubmitEditing={handleReset}
                  style={[styles.passwordInput, { color: colors.foreground }]}
                />
                <Pressable onPress={() => setShowConfirm((v) => !v)} hitSlop={8}>
                  <Feather name={showConfirm ? "eye-off" : "eye"} size={18} color={colors.mutedForeground} />
                </Pressable>
              </View>
            </View>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: colors.destructive + "22", borderColor: colors.destructive + "44" }]}>
                <Feather name="alert-circle" size={14} color={colors.destructive} />
                <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
              </View>
            ) : null}

            <Pressable
              onPress={handleReset}
              disabled={loading || !newPassword || !confirmPassword || !token}
              style={({ pressed }) => [
                styles.btn,
                {
                  backgroundColor: (!newPassword || !confirmPassword || !token) ? colors.muted : colors.primary,
                  opacity: loading ? 0.7 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {loading
                ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                : <Text style={[styles.btnText, { color: (!newPassword || !confirmPassword || !token) ? colors.mutedForeground : colors.primaryForeground }]}>
                    Spremi novu lozinku
                  </Text>
              }
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, justifyContent: "space-between", borderBottomWidth: 1 },
  backCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  topTitle: { fontSize: 16, fontFamily: "Inter_700Bold" },
  scroll: { padding: 24, gap: 20 },
  form: { gap: 16 },
  desc: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  field: { gap: 6 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  passwordWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
  passwordInput: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, borderWidth: 1, padding: 12 },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  btn: { borderRadius: 14, paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  btnText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  doneBox: { alignItems: "center", gap: 16, paddingVertical: 32 },
  doneIcon: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  doneTitle: { fontSize: 22, fontFamily: "Inter_700Bold" },
  doneSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
});
