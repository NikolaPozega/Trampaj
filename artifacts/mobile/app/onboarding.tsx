import AsyncStorage from "@react-native-async-storage/async-storage";
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
import { useListings } from "@/context/ListingsContext";

export const ONBOARDED_KEY = "@trampaj_onboarded_v1";

type Step = 1 | 2 | 3;

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setMyName } = useListings();
  const [step, setStep] = useState<Step>(1);

  // Step 2 fields
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Step 3 fields
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedAge, setAcceptedAge] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;

  function validateStep2(): boolean {
    const e: Record<string, string> = {};
    if (username.trim().length < 2) e.username = "Korisničko ime mora imati najmanje 2 znaka";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = "Nevažeća email adresa";
    if (password.length < 6) e.password = "Lozinka mora imati najmanje 6 znakova";
    if (password !== confirmPassword) e.confirmPassword = "Lozinke se ne podudaraju";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleStep2Next() {
    if (validateStep2()) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setStep(3);
    }
  }

  async function handleFinish() {
    const e: Record<string, string> = {};
    if (!acceptedTerms) e.terms = "Obavezno";
    if (!acceptedPrivacy) e.privacy = "Obavezno";
    if (!acceptedAge) e.age = "Obavezno";
    setErrors(e);
    if (Object.keys(e).length > 0) return;

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setLoading(true);
    try {
      await setMyName(username.trim());
      await AsyncStorage.setItem(ONBOARDED_KEY, "1");
      router.replace("/(tabs)");
    } catch {
      setLoading(false);
    }
  }

  const STEPS = [
    { n: 1, label: "Vrsta računa" },
    { n: 2, label: "Osobni podaci" },
    { n: 3, label: "Kontakt podaci" },
  ];

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Top bar */}
      <View style={[styles.topBar, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => (step > 1 ? setStep((s) => (s - 1) as Step) : router.back())}
          style={({ pressed }) => [styles.back, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <View style={styles.topTabs}>
          <Pressable onPress={() => router.replace("/login")} style={styles.topTab}>
            <Text style={[styles.topTabText, { color: colors.mutedForeground }]}>Prijava</Text>
          </Pressable>
          <View style={[styles.topTab, styles.topTabActive, { borderBottomColor: colors.primary }]}>
            <Text style={[styles.topTabText, { color: colors.primary }]}>Registracija</Text>
          </View>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* Step indicator */}
      <View style={[styles.stepBar, { borderBottomColor: colors.border }]}>
        {STEPS.map((s, i) => {
          const done = step > s.n;
          const active = step === s.n;
          return (
            <React.Fragment key={s.n}>
              <Pressable
                onPress={() => done ? setStep(s.n as Step) : undefined}
                style={styles.stepItem}
              >
                <View style={[
                  styles.stepCircle,
                  {
                    backgroundColor: active ? colors.primary : done ? colors.secondary : colors.muted,
                    borderColor: active ? colors.primary : done ? colors.secondary : colors.border,
                  },
                ]}>
                  {done ? (
                    <Feather name="check" size={12} color="#fff" />
                  ) : (
                    <Text style={[styles.stepNum, { color: active ? colors.primaryForeground : colors.mutedForeground }]}>
                      {s.n}
                    </Text>
                  )}
                </View>
                <Text style={[
                  styles.stepLabel,
                  { color: active ? colors.foreground : done ? colors.secondary : colors.mutedForeground },
                ]}>
                  {s.label}
                </Text>
              </Pressable>
              {i < STEPS.length - 1 && (
                <View style={[styles.stepLine, { backgroundColor: done ? colors.secondary : colors.border }]} />
              )}
            </React.Fragment>
          );
        })}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Already have account? */}
        <View style={styles.alreadyRow}>
          <Text style={[styles.alreadyText, { color: colors.mutedForeground }]}>
            Već imaš profil na Trampaj.hr?{" "}
          </Text>
          <Pressable onPress={() => router.replace("/login")}>
            <Text style={[styles.alreadyLink, { color: colors.secondary }]}>Prijavi se »</Text>
          </Pressable>
        </View>

        {/* ── STEP 1: Vrsta računa ── */}
        {step === 1 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Registracija</Text>
            <Text style={[styles.sectionSub, { color: colors.mutedForeground }]}>
              Odaberi vrstu računa koji ti najviše odgovara.
            </Text>

            <View style={styles.accountTypes}>
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep(2); }}
                style={({ pressed }) => [
                  styles.accountCard,
                  { backgroundColor: colors.card, borderColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={[styles.accountIcon, { backgroundColor: `${colors.primary}22` }]}>
                  <Feather name="user" size={28} color={colors.primary} />
                </View>
                <Text style={[styles.accountTitle, { color: colors.foreground }]}>Privatni korisnik</Text>
                <Text style={[styles.accountDesc, { color: colors.mutedForeground }]}>
                  Trampi predmete koje više ne trebaš — jednostavno, brzo i bez novca
                </Text>
                <View style={[styles.accountBtn, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.accountBtnText, { color: colors.primaryForeground }]}>ODABERI</Text>
                </View>
              </Pressable>

              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStep(2); }}
                style={({ pressed }) => [
                  styles.accountCard,
                  { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View style={[styles.accountIcon, { backgroundColor: `${colors.secondary}22` }]}>
                  <Feather name="briefcase" size={28} color={colors.secondary} />
                </View>
                <Text style={[styles.accountTitle, { color: colors.foreground }]}>Poslovni korisnik</Text>
                <Text style={[styles.accountDesc, { color: colors.mutedForeground }]}>
                  Proširi poslovanje — dosegni tisuće potencijalnih partnera svaki dan
                </Text>
                <View style={[styles.accountBtn, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.accountBtnText, { color: "#fff" }]}>ODABERI</Text>
                </View>
              </Pressable>
            </View>
          </View>
        )}

        {/* ── STEP 2: Osobni podaci ── */}
        {step === 2 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Osobni podaci</Text>

            <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Field
                label="Korisničko ime *"
                value={username}
                onChange={(v) => { setUsername(v); setErrors((e) => ({ ...e, username: "" })); }}
                placeholder="npr. Marko.Z"
                autoCapitalize="words"
                error={errors.username}
                colors={colors}
              />
              <Field
                label="Email adresa"
                value={email}
                onChange={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: "" })); }}
                placeholder="marko@email.com"
                keyboardType="email-address"
                autoCapitalize="none"
                error={errors.email}
                colors={colors}
              />
              <Field
                label="Lozinka *"
                value={password}
                onChange={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: "" })); }}
                placeholder="Najmanje 6 znakova"
                secureTextEntry={!showPass}
                showToggle
                onToggleSecure={() => setShowPass((v) => !v)}
                showingSecure={showPass}
                error={errors.password}
                colors={colors}
              />
              <Field
                label="Potvrdi lozinku *"
                value={confirmPassword}
                onChange={(v) => { setConfirmPassword(v); setErrors((e) => ({ ...e, confirmPassword: "" })); }}
                placeholder="Ponovi lozinku"
                secureTextEntry={!showConfirm}
                showToggle
                onToggleSecure={() => setShowConfirm((v) => !v)}
                showingSecure={showConfirm}
                error={errors.confirmPassword}
                colors={colors}
              />
            </View>

            <Pressable
              onPress={handleStep2Next}
              style={({ pressed }) => [
                styles.nextBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>DALJE →</Text>
            </Pressable>
          </View>
        )}

        {/* ── STEP 3: Kontakt i suglasnost ── */}
        {step === 3 && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Kontakt podaci</Text>

            <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Field
                label="Grad"
                value={city}
                onChange={setCity}
                placeholder="npr. Zagreb"
                autoCapitalize="words"
                colors={colors}
              />
              <Field
                label="Broj mobitela"
                value={phone}
                onChange={setPhone}
                placeholder="npr. 091 123 4567"
                keyboardType="phone-pad"
                colors={colors}
              />
            </View>

            {/* Checkboxes */}
            <View style={[styles.consentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[styles.consentTitle, { color: colors.mutedForeground }]}>Suglasnosti</Text>

              <ConsentRow
                checked={acceptedTerms}
                onToggle={() => setAcceptedTerms((v) => !v)}
                hasError={!!errors.terms}
                colors={colors}
              >
                <Text style={[styles.consentText, { color: colors.foreground }]}>Prihvaćam </Text>
                <Pressable onPress={() => router.push("/terms")} hitSlop={6}>
                  <Text style={[styles.consentLink, { color: colors.secondary }]}>Uvjete korištenja</Text>
                </Pressable>
              </ConsentRow>

              <ConsentRow
                checked={acceptedPrivacy}
                onToggle={() => setAcceptedPrivacy((v) => !v)}
                hasError={!!errors.privacy}
                colors={colors}
              >
                <Text style={[styles.consentText, { color: colors.foreground }]}>Prihvaćam </Text>
                <Pressable onPress={() => router.push("/privacy")} hitSlop={6}>
                  <Text style={[styles.consentLink, { color: colors.secondary }]}>Politiku privatnosti</Text>
                </Pressable>
                <Text style={[styles.consentText, { color: colors.foreground }]}> (GDPR)</Text>
              </ConsentRow>

              <ConsentRow
                checked={acceptedAge}
                onToggle={() => setAcceptedAge((v) => !v)}
                hasError={!!errors.age}
                colors={colors}
              >
                <Text style={[styles.consentText, { color: colors.foreground }]}>
                  Imam najmanje 18 godina
                </Text>
              </ConsentRow>

              {(errors.terms || errors.privacy || errors.age) && (
                <View style={[styles.errorBox, { backgroundColor: `${colors.destructive}18`, borderColor: `${colors.destructive}40` }]}>
                  <Feather name="alert-circle" size={13} color={colors.destructive} />
                  <Text style={[styles.errorText, { color: colors.destructive }]}>
                    Prihvati sve uvjete za nastavak
                  </Text>
                </View>
              )}
            </View>

            <Pressable
              onPress={handleFinish}
              disabled={loading}
              style={({ pressed }) => [
                styles.nextBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>
                {loading ? "Registracija..." : "REGISTRIRAJ SE BESPLATNO"}
              </Text>
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

// ─── Field component ────────────────────────────────────────────────────────

function Field({
  label,
  value,
  onChange,
  placeholder,
  error,
  secureTextEntry,
  showToggle,
  onToggleSecure,
  showingSecure,
  autoCapitalize,
  autoCorrect,
  keyboardType,
  colors,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  error?: string;
  secureTextEntry?: boolean;
  showToggle?: boolean;
  onToggleSecure?: () => void;
  showingSecure?: boolean;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoCorrect?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad" | "decimal-pad";
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const borderColor = error ? colors.destructive : colors.border;
  return (
    <View style={fStyles.wrap}>
      <Text style={[fStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <View style={[fStyles.inputWrap, { borderColor, backgroundColor: colors.muted }]}>
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor={colors.mutedForeground}
          style={[fStyles.input, { color: colors.foreground }]}
          secureTextEntry={secureTextEntry && !showingSecure}
          autoCapitalize={autoCapitalize ?? "none"}
          autoCorrect={autoCorrect ?? false}
          keyboardType={keyboardType ?? "default"}
        />
        {showToggle && (
          <Pressable onPress={onToggleSecure} hitSlop={8}>
            <Feather name={showingSecure ? "eye-off" : "eye"} size={17} color={colors.mutedForeground} />
          </Pressable>
        )}
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

// ─── ConsentRow component ────────────────────────────────────────────────────

function ConsentRow({
  checked,
  onToggle,
  hasError,
  colors,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  hasError?: boolean;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={cStyles.row}>
      <Pressable onPress={onToggle} hitSlop={8}>
        <View style={[
          cStyles.box,
          {
            backgroundColor: checked ? colors.primary : colors.muted,
            borderColor: hasError ? colors.destructive : checked ? colors.primary : colors.border,
          },
        ]}>
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

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 0,
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  back: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  topTabs: { flexDirection: "row", flex: 1, justifyContent: "center" },
  topTab: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 2, borderBottomColor: "transparent" },
  topTabActive: {},
  topTabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  stepBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
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
  consentCard: { borderRadius: 16, borderWidth: 1, padding: 16, gap: 14 },
  consentTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4 },
  consentText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  consentLink: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 8, padding: 10 },
  errorText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  nextBtn: { paddingVertical: 15, borderRadius: 10, alignItems: "center" },
  nextBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  footerNote: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 16 },
});
