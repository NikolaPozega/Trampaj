import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";

const FALLBACK_DOMAIN = "trampaj.hr";
const API_BASE = `https://${process.env["EXPO_PUBLIC_DOMAIN"] ?? FALLBACK_DOMAIN}/api`;

const BIO_ASKED_KEY    = "@trampaj_bio_asked_v1";
const BIO_ENABLED_KEY  = "@trampaj_bio_enabled_v1";
const BIO_CREDS_KEY    = "@trampaj_bio_creds_v1";

export default function VerifyEmailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { token, jwt } = useLocalSearchParams<{ token?: string; jwt?: string }>();
  const { loginWithToken, login } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  // Biometric setup modal state
  const [bioModalVisible, setBioModalVisible] = useState(false);
  const [bioUsername, setBioUsername] = useState("");
  const [bioPassword, setBioPassword] = useState("");
  const [bioLoading, setBioLoading] = useState(false);
  const [bioError, setBioError] = useState("");
  const passwordInputRef = useRef<TextInput>(null);

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;

  async function promptBiometrics(username: string) {
    if (Platform.OS === "web") return;
    try {
      const asked = await AsyncStorage.getItem(BIO_ASKED_KEY);
      if (asked) return;
      const hasHw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHw || !enrolled) return;
      await AsyncStorage.setItem(BIO_ASKED_KEY, "asked");
      Alert.alert(
        "Brža prijava",
        "Aktiviraj prijavu otiskom prsta ili licem — nećeš morati upisivati lozinku sljedeći put.",
        [
          { text: "Ne, hvala", style: "cancel" },
          {
            text: "Aktiviraj",
            onPress: () => {
              setBioUsername(username);
              setBioPassword("");
              setBioError("");
              setBioModalVisible(true);
            },
          },
        ]
      );
    } catch { /* ignore */ }
  }

  async function confirmBioSetup() {
    if (!bioPassword) return;
    setBioLoading(true);
    setBioError("");
    const r = await login(bioUsername, bioPassword);
    setBioLoading(false);
    if (r.ok) {
      await AsyncStorage.setItem(BIO_ENABLED_KEY, "yes");
      await AsyncStorage.setItem(BIO_CREDS_KEY, JSON.stringify({ username: bioUsername, password: bioPassword }));
      setBioModalVisible(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Aktivirano!", "Sljedeći put prijavi se otiskom prsta ili licem.");
    } else {
      setBioError("Netočna lozinka. Pokušaj ponovo.");
    }
  }

  useEffect(() => {
    if (jwt) {
      loginWithToken(jwt).then(async (result) => {
        if (result.ok && result.user) {
          setStatus("success");
          setMessage("Email potvrđen! Prijavljen si.");
          await promptBiometrics(result.user.username);
          setTimeout(() => router.replace("/(tabs)"), 1400);
        } else {
          setStatus("error");
          setMessage(result.error ?? "Pogreška pri prijavi.");
        }
      });
      return;
    }

    if (!token) {
      setStatus("error");
      setMessage("Nevažeći link za verifikaciju.");
      return;
    }

    fetch(`${API_BASE}/auth/verify/${token}`, {
      headers: { Accept: "application/json" },
    })
      .then((r) => r.json())
      .then((data: { message?: string; token?: string; user?: { username: string }; error?: string }) => {
        if (data.error) {
          setStatus("error");
          setMessage(data.error);
        } else {
          if (data.token) {
            loginWithToken(data.token).then(async (r) => {
              setStatus(r.ok ? "success" : "error");
              setMessage(r.ok ? (data.message ?? "Email potvrđen!") : (r.error ?? "Greška pri prijavi."));
              if (r.ok) {
                const uname = data.user?.username ?? (r.user?.username ?? "");
                if (uname) await promptBiometrics(uname);
                setTimeout(() => router.replace("/(tabs)"), 1400);
              }
            });
          } else {
            setStatus("success");
            setMessage(data.message ?? "Email potvrđen!");
          }
        }
      })
      .catch(() => {
        setStatus("error");
        setMessage("Pogreška pri verifikaciji. Pokušaj ponovo.");
      });
  }, [token, jwt]); // eslint-disable-line react-hooks/exhaustive-deps

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
              {message || "Tvoj profil je aktivan. Preusmjeravamo te..."}
            </Text>
            <Pressable
              onPress={() => router.replace("/(tabs)")}
              style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Idi na oglase →</Text>
            </Pressable>
          </>
        )}

        {status === "error" && (
          <>
            <View style={[styles.iconCircle, { backgroundColor: "#3A1A1A" }]}>
              <Feather name="x-circle" size={48} color="#F87171" />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>Pogreška</Text>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{message}</Text>
            <Pressable
              onPress={() => router.replace("/login")}
              style={({ pressed }) => [styles.btn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.btnText, { color: colors.primaryForeground }]}>Idi na prijavu</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* Biometric setup modal */}
      <Modal
        visible={bioModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBioModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalIconRow}>
              <Feather name="lock" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Aktiviraj brzu prijavu</Text>
            <Text style={[styles.modalSubtitle, { color: colors.mutedForeground }]}>
              Upiši lozinku jednom da aktiviraš prijavu otiskom prsta ili licem.
            </Text>
            <TextInput
              ref={passwordInputRef}
              style={[styles.modalInput, { backgroundColor: colors.muted, color: colors.foreground, borderColor: bioError ? "#F87171" : colors.border }]}
              placeholder="Lozinka"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              value={bioPassword}
              onChangeText={v => { setBioPassword(v); setBioError(""); }}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={confirmBioSetup}
            />
            {!!bioError && (
              <Text style={styles.modalError}>{bioError}</Text>
            )}
            <View style={styles.modalBtns}>
              <Pressable
                onPress={() => setBioModalVisible(false)}
                style={({ pressed }) => [styles.modalBtnSecondary, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.modalBtnSecondaryText, { color: colors.mutedForeground }]}>Odustani</Text>
              </Pressable>
              <Pressable
                onPress={confirmBioSetup}
                disabled={bioLoading || !bioPassword}
                style={({ pressed }) => [styles.modalBtnPrimary, { backgroundColor: colors.primary, opacity: (pressed || bioLoading || !bioPassword) ? 0.6 : 1 }]}
              >
                {bioLoading
                  ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                  : <Text style={[styles.modalBtnPrimaryText, { color: colors.primaryForeground }]}>Aktiviraj</Text>
                }
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalCard: { width: "100%", maxWidth: 360, borderRadius: 16, padding: 24, borderWidth: 1, gap: 12 },
  modalIconRow: { alignItems: "center", marginBottom: 4 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center" },
  modalSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  modalInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular" },
  modalError: { fontSize: 12, color: "#F87171", fontFamily: "Inter_400Regular" },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalBtnSecondary: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: "center" },
  modalBtnSecondaryText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  modalBtnPrimary: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: "center" },
  modalBtnPrimaryText: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
