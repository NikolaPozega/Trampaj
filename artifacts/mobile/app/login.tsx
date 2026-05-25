import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import * as LocalAuthentication from "expo-local-authentication";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
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

const BIO_ASKED_KEY = "@trampaj_bio_asked_v1";
const BIO_ENABLED_KEY = "@trampaj_bio_enabled_v1";
const BIO_CREDS_KEY = "@trampaj_bio_creds_v1";
const SAVED_USERNAME_KEY = "@trampaj_saved_username_v1";

export default function LoginScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { login, tryAutoLogin } = useAuth();
  const { setMyName } = useListings();
  const [bioEnabled, setBioEnabled] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notVerified, setNotVerified] = useState(false);
  const [notVerifiedEmail, setNotVerifiedEmail] = useState("");
  const [showBioConfirm, setShowBioConfirm] = useState(false);
  const [bioConfirmPassword, setBioConfirmPassword] = useState("");
  const [bioConfirmLoading, setBioConfirmLoading] = useState(false);
  const [bioConfirmError, setBioConfirmError] = useState("");

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(BIO_ENABLED_KEY),
      AsyncStorage.getItem(SAVED_USERNAME_KEY),
    ]).then(([bio, savedUser]) => {
      setBioEnabled(bio === "yes");
      if (savedUser) setUsername(savedUser);
    });
  }, []);

  async function checkBiometricAfterLogin(savedUser: string, savedPass: string) {
    const asked = await AsyncStorage.getItem(BIO_ASKED_KEY);
    if (asked) return;
    let hasHw = false;
    let enrolled = false;
    try {
      hasHw = await LocalAuthentication.hasHardwareAsync();
      enrolled = await LocalAuthentication.isEnrolledAsync();
    } catch { /* web — skip */ }
    if (!hasHw || !enrolled) return;
    await AsyncStorage.setItem(BIO_ASKED_KEY, "asked");
    Alert.alert(
      "Brža prijava",
      "Aktiviraj prijavu otiskom prsta ili licem — nećeš morati upisivati lozinku. Možeš isključiti u Profilu.",
      [
        { text: "Ne, hvala", style: "cancel" },
        {
          text: "Aktiviraj",
          onPress: async () => {
            await AsyncStorage.setItem(BIO_ENABLED_KEY, "yes");
            await AsyncStorage.setItem(BIO_CREDS_KEY, JSON.stringify({ username: savedUser, password: savedPass }));
            setBioEnabled(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          },
        },
      ]
    );
  }

  async function doLoginWithStoredCreds(savedUser: string, savedPass: string) {
    setLoading(true);
    const r = await login(savedUser, savedPass);
    setLoading(false);
    if (r.ok) {
      await setMyName(savedUser);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } else {
      await AsyncStorage.multiRemove([BIO_CREDS_KEY, BIO_ENABLED_KEY, BIO_ASKED_KEY]);
      setBioEnabled(false);
      Alert.alert("Biometrija deaktivirana", "Lozinka se promijenila. Prijavi se ručno i aktiviraj biometriju ponovno.");
    }
  }

  async function handleBioLogin() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const savedCredsRaw = await AsyncStorage.getItem(BIO_CREDS_KEY);
    if (!savedCredsRaw) {
      Alert.alert(
        "Biometrija nije aktivirana",
        "Prijavi se lozinkom, idi na Profil i aktiviraj biometrijsku prijavu u postavkama."
      );
      return;
    }

    // Check if native biometrics are available
    let hasNativeBio = false;
    try {
      const hasHw = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      hasNativeBio = hasHw && enrolled;
    } catch {
      // Web — biometrics not supported
    }

    if (hasNativeBio) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Prijavi se biometricom",
        fallbackLabel: "Koristi lozinku",
        disableDeviceFallback: false,
      });
      if (!result.success) return;
      const { username: savedUser, password: savedPass } = JSON.parse(savedCredsRaw) as { username: string; password: string };
      await doLoginWithStoredCreds(savedUser, savedPass);
    } else {
      // No hardware biometrics (web) — ask for password confirmation
      setBioConfirmPassword("");
      setBioConfirmError("");
      setShowBioConfirm(true);
    }
  }

  async function confirmBioLogin() {
    if (!bioConfirmPassword) return;
    const savedCredsRaw = await AsyncStorage.getItem(BIO_CREDS_KEY);
    if (!savedCredsRaw) { setShowBioConfirm(false); return; }
    const { username: savedUser } = JSON.parse(savedCredsRaw) as { username: string; password: string };
    setBioConfirmLoading(true);
    setBioConfirmError("");
    const r = await login(savedUser, bioConfirmPassword);
    setBioConfirmLoading(false);
    if (r.ok) {
      setShowBioConfirm(false);
      await setMyName(savedUser);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
    } else {
      setBioConfirmError("Pogrešna lozinka. Pokušaj ponovo.");
    }
  }

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
      await setMyName(username.trim());
      if (rememberMe) {
        await AsyncStorage.setItem(SAVED_USERNAME_KEY, username.trim());
      } else {
        await AsyncStorage.removeItem(SAVED_USERNAME_KEY);
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace("/(tabs)");
      setTimeout(() => checkBiometricAfterLogin(username.trim(), password), 800);
    } else if (result.notVerified) {
      setNotVerified(true);
      setNotVerifiedEmail(result.email ?? "");
    } else {
      setError(result.error ?? "Greška pri prijavi");
    }
  }

  function handleSocial(name: string) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Alert.alert("Uskoro dostupno", `Prijava putem ${name} stiže uskoro.`);
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.replace("/(tabs)")}
          style={({ pressed }) => [styles.logoBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={[styles.logoMini, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="refresh-cw" size={16} color={colors.primary} />
          </View>
          <Text style={[styles.logoText, { color: colors.foreground }]}>
            Trampaj<Text style={{ color: colors.secondary }}>.hr</Text>
          </Text>
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
          <View style={styles.subtitleRow}>
            <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>Još nemaš profil na Trampaj.hr? </Text>
            <Pressable onPress={() => router.push("/onboarding")} hitSlop={8}>
              <Text style={[styles.link, { color: colors.secondary }]}>Registriraj se »</Text>
            </Pressable>
          </View>
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
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  Alert.alert(
                    "Reset lozinke",
                    "Upiši svoju email adresu i poslaćemo ti link za postavljanje nove lozinke.",
                    [
                      { text: "Odustani", style: "cancel" },
                      {
                        text: "Pošalji",
                        onPress: () => {
                          Alert.alert("Email poslan", "Ako postoji račun s tim emailom, dobit ćeš link za reset lozinke.");
                        },
                      },
                    ]
                  );
                }}
                hitSlop={8}
              >
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

        {/* Biometric button */}
        {bioEnabled && (
          <Pressable
            onPress={handleBioLogin}
            disabled={loading}
            style={({ pressed }) => [styles.bioBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
          >
            <Feather name="lock" size={18} color={colors.secondary} />
            <Text style={[styles.bioBtnText, { color: colors.foreground }]}>Prijava otiskom / licem</Text>
            <Feather name="chevron-right" size={15} color={colors.mutedForeground} />
          </Pressable>
        )}

        {/* Divider */}
        <View style={styles.dividerRow}>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>ili nastavi s</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        {/* Social buttons */}
        <View style={styles.socialButtons}>
          <Pressable
            onPress={() => handleSocial("Google")}
            style={({ pressed }) => [styles.socialBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={styles.googleG}>G</Text>
            <Text style={[styles.socialBtnText, { color: colors.foreground }]}>Nastavi s Google računom</Text>
          </Pressable>
          <Pressable
            onPress={() => handleSocial("Apple")}
            style={({ pressed }) => [styles.socialBtn, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
          >
            <Feather name="smartphone" size={18} color={colors.foreground} />
            <Text style={[styles.socialBtnText, { color: colors.foreground }]}>Nastavi s Apple računom</Text>
          </Pressable>
          <Pressable
            onPress={() => handleSocial("Facebook")}
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

      {/* Bio confirm password modal (web fallback) */}
      <Modal visible={showBioConfirm} transparent animationType="fade" onRequestClose={() => setShowBioConfirm(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", alignItems: "center", padding: 24 }}
          onPress={() => setShowBioConfirm(false)}
        >
          <Pressable
            style={{ width: "100%", maxWidth: 340, backgroundColor: colors.card, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 20, gap: 14 }}
            onPress={() => {}}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 16, fontFamily: "Inter_700Bold", color: colors.foreground }}>Potvrdi identitet</Text>
              <Pressable onPress={() => setShowBioConfirm(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 18 }}>
              Unesi lozinku za potvrdu brze prijave.
            </Text>
            <TextInput
              value={bioConfirmPassword}
              onChangeText={(t) => { setBioConfirmPassword(t); setBioConfirmError(""); }}
              placeholder="Lozinka"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              style={{
                borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11,
                fontSize: 14, fontFamily: "Inter_400Regular",
                borderColor: bioConfirmError ? colors.destructive : colors.border,
                color: colors.foreground, backgroundColor: colors.muted,
              }}
            />
            {bioConfirmError ? (
              <Text style={{ fontSize: 12, fontFamily: "Inter_400Regular", color: colors.destructive }}>{bioConfirmError}</Text>
            ) : null}
            <Pressable
              onPress={confirmBioLogin}
              disabled={bioConfirmLoading || !bioConfirmPassword}
              style={({ pressed }) => [{
                borderRadius: 10, paddingVertical: 13, alignItems: "center" as const,
                backgroundColor: colors.primary,
                opacity: (!bioConfirmPassword || bioConfirmLoading) ? 0.5 : pressed ? 0.85 : 1,
              }]}
            >
              {bioConfirmLoading
                ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                : <Text style={{ fontSize: 14, fontFamily: "Inter_700Bold", color: colors.primaryForeground }}>Prijavi se</Text>}
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 0, justifyContent: "space-between", borderBottomWidth: 1 },
  logoBtn: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 10 },
  logoMini: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  bioBtn: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14 },
  bioBtnText: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold" },
  topTabs: { flexDirection: "row", flex: 1, justifyContent: "center" },
  topTab: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: "transparent" },
  topTabActive: {},
  topTabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  scroll: { padding: 20, gap: 20 },
  titleSection: { gap: 6 },
  title: { fontSize: 26, fontFamily: "Inter_700Bold" },
  subtitleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  subtitle: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  link: { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 18 },
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
