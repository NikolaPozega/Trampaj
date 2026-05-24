import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { compressImage } from "@/utils/compressImage";
import * as Location from "expo-location";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

export const ONBOARDED_KEY = "@trampaj_onboarded_v1";

type Step = 1 | 2;

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();
  const { setMyName } = useListings();
  const [step, setStep] = useState<Step>(1);

  // Step 2
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Step 3
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [gpsLoading, setGpsLoading] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [avatarBase64, setAvatarBase64] = useState<string | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedAge, setAcceptedAge] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // After registration
  const [registered, setRegistered] = useState(false);
  const [devLink, setDevLink] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState("");

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;

  function validateStep2(): boolean {
    const e: Record<string, string> = {};
    if (username.trim().length < 2) e.username = "Najmanje 2 znaka";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Nevažeći email";
    if (!email.trim()) e.email = "Email je obavezan";
    if (password.length < 6) e.password = "Najmanje 6 znakova";
    if (password !== confirmPassword) e.confirmPassword = "Lozinke se ne podudaraju";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleGetGps() {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Dozvola odbijena", "Omogući pristup lokaciji u postavkama uređaja.");
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${loc.coords.latitude}&lon=${loc.coords.longitude}&accept-language=hr`,
          { headers: { "User-Agent": "Trampaj/1.0" } }
        );
        const data = await resp.json();
        const a = data.address ?? {};
        const city = a.city || a.town || a.village || a.municipality || "";
        const region = a.county || a.state_district || a.state || "";
        setAddress(city && region && region !== city ? `${city}, ${region}` : city || (data.display_name ?? "").split(",")[0] || "");
      } catch {
        const [result] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (result) {
          const city = result.city || result.district || result.subregion || result.name || "";
          setAddress(city);
        }
      }
    } catch {
      Alert.alert("Greška", "Nije moguće dohvatiti lokaciju.");
    } finally {
      setGpsLoading(false);
    }
  }

  async function handlePickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Dozvola odbijena", "Omogući pristup galeriji u postavkama.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets[0]) {
      const compressed = await compressImage(result.assets[0].uri, 400, 0.65);
      setAvatarUri(compressed.uri);
      setAvatarBase64(`data:image/jpeg;base64,${compressed.base64}`);
    }
  }

  async function handleFinish() {
    const e: Record<string, string> = {};
    if (!acceptedTerms) e.terms = "Obavezno";
    if (!acceptedPrivacy) e.privacy = "Obavezno";
    if (!acceptedAge) e.age = "Obavezno";
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    setLoading(true);
    const result = await register({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      city: undefined,
      avatarBase64: avatarBase64 || undefined,
    });
    setLoading(false);

    if (!result.ok) {
      setErrors({ submit: result.error ?? "Greška pri registraciji" });
      return;
    }

    await setMyName(username.trim());
    await AsyncStorage.setItem(ONBOARDED_KEY, "1");

    setRegisteredEmail(email.trim().toLowerCase());
    setEmailSent(result.emailSent ?? false);
    setDevLink(result.devVerifyLink ?? null);
    setRegistered(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  const STEPS = [
    { n: 1, label: "Osobni podaci" },
    { n: 2, label: "Kontakt podaci" },
  ];

  // ── Post-registration screen ──────────────────────────────────────────────
  if (registered) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={styles.successContent}>
          <View style={[styles.successIcon, { backgroundColor: "#1A3A2A" }]}>
            <Feather name="mail" size={40} color="#4ADE80" />
          </View>
          <Text style={[styles.successTitle, { color: colors.foreground }]}>Registracija uspješna!</Text>
          <Text style={[styles.successSub, { color: colors.mutedForeground }]}>
            {emailSent
              ? `Poslali smo link za potvrdu na ${registeredEmail}. Provjeri inbox i klikni link.`
              : `Provjeri email ${registeredEmail} za potvrdu profila.`}
          </Text>

          {devLink && (
            <View style={[styles.devLinkBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Text style={[styles.devLinkLabel, { color: colors.mutedForeground }]}>
                🔧 Dev mode — SMTP nije konfiguriran. Klikni ovaj link za aktivaciju:
              </Text>
              <Pressable onPress={() => router.push(devLink.replace(/.*\/verify-email/, "/verify-email"))}>
                <Text style={[styles.devLink, { color: colors.secondary }]} numberOfLines={3}>
                  {devLink}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const path = devLink.replace(/.*\/verify-email\?token=/, "/verify-email?token=");
                  router.push(path as never);
                }}
                style={({ pressed }) => [styles.devLinkBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              >
                <Text style={[styles.devLinkBtnText, { color: colors.primaryForeground }]}>Potvrdi email odmah →</Text>
              </Pressable>
            </View>
          )}

          <Pressable
            onPress={() => router.replace("/login")}
            style={({ pressed }) => [styles.successBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.successBtnText, { color: colors.primaryForeground }]}>Idi na prijavu</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
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
          <Pressable onPress={() => router.replace("/login")} style={styles.topTab}>
            <Text style={[styles.topTabText, { color: colors.mutedForeground }]}>Prijava</Text>
          </Pressable>
          <View style={[styles.topTab, styles.topTabActive, { borderBottomColor: colors.primary }]}>
            <Text style={[styles.topTabText, { color: colors.primary }]}>Registracija</Text>
          </View>
        </View>
        {step > 1 ? (
          <Pressable
            onPress={() => setStep((s) => (s - 1) as Step)}
            style={({ pressed }) => [styles.back, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="arrow-left" size={18} color={colors.foreground} />
          </Pressable>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {/* Step bar */}
      <View style={[styles.stepBar, { borderBottomColor: colors.border }]}>
        {STEPS.map((s, i) => {
          const done = step > s.n;
          const active = step === s.n;
          return (
            <React.Fragment key={s.n}>
              <Pressable onPress={() => done ? setStep(s.n as Step) : undefined} style={styles.stepItem}>
                <View style={[styles.stepCircle, {
                  backgroundColor: active ? colors.primary : done ? colors.secondary : colors.muted,
                  borderColor: active ? colors.primary : done ? colors.secondary : colors.border,
                }]}>
                  {done ? <Feather name="check" size={12} color="#fff" /> : (
                    <Text style={[styles.stepNum, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>{s.n}</Text>
                  )}
                </View>
                <Text style={[styles.stepLabel, { color: active ? colors.foreground : done ? colors.secondary : colors.mutedForeground }]}>
                  {s.label}
                </Text>
              </Pressable>
              {i < STEPS.length - 1 && <View style={[styles.stepLine, { backgroundColor: done ? colors.secondary : colors.border }]} />}
            </React.Fragment>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.alreadyRow}>
          <Text style={[styles.alreadyText, { color: colors.mutedForeground }]}>Već imaš profil? </Text>
          <Pressable onPress={() => router.replace("/login")}>
            <Text style={[styles.alreadyLink, { color: colors.secondary }]}>Prijavi se »</Text>
          </Pressable>
        </View>

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Osobni podaci</Text>
            <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Field label="Korisničko ime *" value={username} onChange={(v) => { setUsername(v); setErrors((e) => ({ ...e, username: "" })); }}
                placeholder="npr. Marko.Z" autoCapitalize="words" error={errors.username} colors={colors} />
              <Field label="Email adresa *" value={email} onChange={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: "" })); }}
                placeholder="marko@email.com" keyboardType="email-address" error={errors.email} colors={colors} />
              <Field label="Lozinka *" value={password} onChange={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: "" })); }}
                placeholder="Najmanje 6 znakova" secureTextEntry={!showPass} showToggle onToggleSecure={() => setShowPass((v) => !v)}
                showingSecure={showPass} error={errors.password} colors={colors} />
              <Field label="Potvrdi lozinku *" value={confirmPassword} onChange={(v) => { setConfirmPassword(v); setErrors((e) => ({ ...e, confirmPassword: "" })); }}
                placeholder="Ponovi lozinku" secureTextEntry={!showConfirm} showToggle onToggleSecure={() => setShowConfirm((v) => !v)}
                showingSecure={showConfirm} error={errors.confirmPassword} colors={colors} />
            </View>
            <Pressable onPress={() => validateStep2() && (Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light), setStep(2))}
              style={({ pressed }) => [styles.nextBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
              <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>DALJE →</Text>
            </Pressable>
          </View>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Kontakt podaci</Text>

            {/* Photo upload */}
            <View style={[styles.photoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.photoLabel, { color: colors.mutedForeground }]}>Profilna slika (opcionalno)</Text>
              <View style={styles.photoRow}>
                <Pressable onPress={handlePickPhoto} style={[styles.avatarBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <Feather name="user" size={32} color={colors.mutedForeground} />
                  )}
                </Pressable>
                <View style={{ flex: 1, gap: 8 }}>
                  <Pressable
                    onPress={handlePickPhoto}
                    style={({ pressed }) => [styles.photoBtn, { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Feather name="image" size={14} color={colors.primary} />
                    <Text style={[styles.photoBtnText, { color: colors.primary }]}>
                      {avatarUri ? "Promijeni sliku" : "Odaberi iz galerije"}
                    </Text>
                  </Pressable>
                  {avatarUri && (
                    <Pressable onPress={() => { setAvatarUri(null); setAvatarBase64(null); }}>
                      <Text style={[styles.removePhoto, { color: colors.destructive }]}>Ukloni sliku</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            </View>

            {/* Address + GPS */}
            <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.addressField}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Adresa</Text>
                <View style={styles.addressInputRow}>
                  <TextInput
                    value={address}
                    onChangeText={setAddress}
                    placeholder="npr. Ilica 10, Zagreb"
                    placeholderTextColor={colors.mutedForeground}
                    style={[styles.addressInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted }]}
                    autoCapitalize="words"
                  />
                  <Pressable
                    onPress={handleGetGps}
                    disabled={gpsLoading}
                    style={({ pressed }) => [styles.gpsBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
                  >
                    {gpsLoading
                      ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                      : <Feather name="navigation" size={16} color={colors.primaryForeground} />}
                  </Pressable>
                </View>
                <Text style={[styles.gpsHint, { color: colors.mutedForeground }]}>
                  Upiši ručno ili koristi GPS za automatsko popunjavanje
                </Text>
              </View>

              <Field label="Broj mobitela" value={phone} onChange={setPhone}
                placeholder="npr. 091 123 4567" keyboardType="phone-pad" colors={colors} />
            </View>

            {/* Consents */}
            <View style={[styles.consentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.consentTitle, { color: colors.mutedForeground }]}>Suglasnosti</Text>
              <ConsentRow checked={acceptedTerms} onToggle={() => setAcceptedTerms((v) => !v)} hasError={!!errors.terms} colors={colors}>
                <Text style={[styles.consentText, { color: colors.foreground }]}>Prihvaćam </Text>
                <Pressable onPress={() => router.push("/terms")} hitSlop={6}>
                  <Text style={[styles.consentLink, { color: colors.secondary }]}>Uvjete korištenja</Text>
                </Pressable>
              </ConsentRow>
              <ConsentRow checked={acceptedPrivacy} onToggle={() => setAcceptedPrivacy((v) => !v)} hasError={!!errors.privacy} colors={colors}>
                <Text style={[styles.consentText, { color: colors.foreground }]}>Prihvaćam </Text>
                <Pressable onPress={() => router.push("/privacy")} hitSlop={6}>
                  <Text style={[styles.consentLink, { color: colors.secondary }]}>Politiku privatnosti</Text>
                </Pressable>
                <Text style={[styles.consentText, { color: colors.foreground }]}> (GDPR)</Text>
              </ConsentRow>
              <ConsentRow checked={acceptedAge} onToggle={() => setAcceptedAge((v) => !v)} hasError={!!errors.age} colors={colors}>
                <Text style={[styles.consentText, { color: colors.foreground }]}>Imam najmanje 18 godina</Text>
              </ConsentRow>
              {(errors.terms || errors.privacy || errors.age || errors.submit) && (
                <View style={[styles.errorBox, { backgroundColor: `${colors.destructive}18`, borderColor: `${colors.destructive}40` }]}>
                  <Feather name="alert-circle" size={13} color={colors.destructive} />
                  <Text style={[styles.errorText, { color: colors.destructive }]}>
                    {errors.submit || "Prihvati sve uvjete za nastavak"}
                  </Text>
                </View>
              )}
            </View>

            <Pressable onPress={handleFinish} disabled={loading}
              style={({ pressed }) => [styles.nextBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}>
              {loading ? <ActivityIndicator color={colors.primaryForeground} /> : (
                <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>REGISTRIRAJ SE BESPLATNO</Text>
              )}
            </Pressable>

            <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>
              Trampaj.hr ne pohrani financijske podatke niti lozinke.{"\n"}
              Svi osobni podaci mogu se obrisati u postavkama profila.
            </Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, placeholder, error, secureTextEntry, showToggle, onToggleSecure, showingSecure, autoCapitalize, keyboardType, colors }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; error?: string;
  secureTextEntry?: boolean; showToggle?: boolean; onToggleSecure?: () => void; showingSecure?: boolean;
  autoCapitalize?: "none" | "sentences" | "words"; keyboardType?: "default" | "email-address" | "phone-pad";
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  return (
    <View style={fStyles.wrap}>
      <Text style={[fStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[fStyles.inputWrap, { borderColor: error ? colors.destructive : colors.border, backgroundColor: colors.muted }]}>
        <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.mutedForeground}
          style={[fStyles.input, { color: colors.foreground }]} secureTextEntry={secureTextEntry && !showingSecure}
          autoCapitalize={autoCapitalize ?? "none"} autoCorrect={false} keyboardType={keyboardType ?? "default"} />
        {showToggle && <Pressable onPress={onToggleSecure} hitSlop={8}>
          <Feather name={showingSecure ? "eye-off" : "eye"} size={17} color={colors.mutedForeground} />
        </Pressable>}
      </View>
      {error ? <Text style={[fStyles.error, { color: colors.destructive }]}>{error}</Text> : null}
    </View>
  );
}
const fStyles = StyleSheet.create({
  wrap: { gap: 5 },
  label: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  inputWrap: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 4 },
  input: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", paddingVertical: 9 },
  error: { fontSize: 11, fontFamily: "Inter_400Regular" },
});

function ConsentRow({ checked, onToggle, hasError, colors, children }: {
  checked: boolean; onToggle: () => void; hasError?: boolean;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>; children: React.ReactNode;
}) {
  return (
    <View style={cStyles.row}>
      <Pressable onPress={onToggle} hitSlop={8}>
        <View style={[cStyles.box, { backgroundColor: checked ? colors.primary : colors.muted, borderColor: hasError ? colors.destructive : checked ? colors.primary : colors.border }]}>
          {checked && <Feather name="check" size={11} color={colors.primaryForeground} />}
        </View>
      </Pressable>
      <View style={cStyles.content}>{children}</View>
    </View>
  );
}
const cStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  box: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0 },
  content: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 2 },
});

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 0, justifyContent: "space-between", borderBottomWidth: 1 },
  logoBtn: { flexDirection: "row", alignItems: "center", gap: 7, paddingVertical: 10 },
  logoMini: { width: 32, height: 32, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: 17, fontFamily: "Inter_700Bold", letterSpacing: -0.3 },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  topTabs: { flexDirection: "row", flex: 1, justifyContent: "center" },
  topTab: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: "transparent" },
  topTabActive: {},
  topTabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  stepBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1 },
  stepItem: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  stepCircle: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  stepNum: { fontSize: 12, fontFamily: "Inter_700Bold" },
  stepLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  stepLine: { flex: 1, height: 1, marginHorizontal: 6 },
  scroll: { padding: 20, gap: 20 },
  alreadyRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  alreadyText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  alreadyLink: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  section: { gap: 16 },
  sectionTitle: { fontSize: 26, fontFamily: "Inter_700Bold" },
  sectionSub: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginTop: -8 },
  accountTypes: { gap: 14 },
  accountCard: { borderRadius: 16, borderWidth: 1, padding: 20, gap: 10, alignItems: "center" },
  accountIcon: { width: 60, height: 60, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  accountTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  accountDesc: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  accountBtn: { width: "100%", paddingVertical: 12, borderRadius: 10, alignItems: "center", marginTop: 4 },
  accountBtnText: { fontSize: 14, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  formCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 14 },
  photoCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 10 },
  photoLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4 },
  photoRow: { flexDirection: "row", gap: 14, alignItems: "center" },
  avatarBox: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 },
  photoBtn: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5 },
  photoBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  removePhoto: { fontSize: 12, fontFamily: "Inter_400Regular" },
  addressField: { gap: 6 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  addressInputRow: { flexDirection: "row", gap: 8 },
  addressInput: { flex: 1, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  gpsBtn: { width: 46, height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  gpsHint: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15 },
  consentCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 14 },
  consentTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4 },
  consentText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  consentLink: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 8, padding: 10 },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  nextBtn: { paddingVertical: 15, borderRadius: 10, alignItems: "center" },
  nextBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  footerNote: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 16 },
  successContent: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  successIcon: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center" },
  successSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  devLinkBox: { width: "100%", borderRadius: 12, borderWidth: 1, padding: 14, gap: 8 },
  devLinkLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  devLink: { fontSize: 11, fontFamily: "Inter_400Regular" },
  devLinkBtn: { paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  devLinkBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  successBtn: { paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12, marginTop: 8 },
  successBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
});
