import AsyncStorage from "@react-native-async-storage/async-storage";
import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
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

export default function OnboardingScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { setMyName } = useListings();
  const [name, setName] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);
  const [acceptedAge, setAcceptedAge] = useState(false);
  const [loading, setLoading] = useState(false);

  const canRegister =
    name.trim().length >= 2 && acceptedTerms && acceptedPrivacy && acceptedAge;

  async function handleRegister() {
    if (!canRegister) return;
    setLoading(true);
    try {
      await setMyName(name.trim());
      await AsyncStorage.setItem(ONBOARDED_KEY, "1");
      router.replace("/(tabs)");
    } catch {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoWrap}>
          <View style={[styles.logoIcon, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="refresh-cw" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.logoText, { color: colors.foreground }]}>
            Trampaj<Text style={{ color: colors.secondary }}>.hr</Text>
          </Text>
          <Text style={[styles.tagline, { color: colors.mutedForeground }]}>
            Trampa bez novca — razmijeni što više ne trebaš
          </Text>
        </View>

        {/* Form card */}
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>Stvori profil</Text>
          <Text style={[styles.cardSub, { color: colors.mutedForeground }]}>
            Upiši ime ili nadimak koji će korisnici vidjet
          </Text>

          <View style={styles.fieldWrap}>
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Korisničko ime *</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="npr. Marko Z."
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted }]}
              autoCapitalize="words"
              maxLength={40}
              returnKeyType="done"
            />
          </View>

          {/* Checkboxes */}
          <View style={styles.checkboxSection}>
            <CheckRow checked={acceptedTerms} onToggle={() => setAcceptedTerms((v) => !v)} colors={colors}>
              <Text style={[styles.checkText, { color: colors.foreground }]}>Prihvaćam </Text>
              <Pressable onPress={() => router.push("/terms")} hitSlop={6}>
                <Text style={[styles.checkLink, { color: colors.primary }]}>Uvjete korištenja</Text>
              </Pressable>
            </CheckRow>

            <CheckRow checked={acceptedPrivacy} onToggle={() => setAcceptedPrivacy((v) => !v)} colors={colors}>
              <Text style={[styles.checkText, { color: colors.foreground }]}>Prihvaćam </Text>
              <Pressable onPress={() => router.push("/privacy")} hitSlop={6}>
                <Text style={[styles.checkLink, { color: colors.primary }]}>Politiku privatnosti</Text>
              </Pressable>
              <Text style={[styles.checkText, { color: colors.foreground }]}> (GDPR)</Text>
            </CheckRow>

            <CheckRow checked={acceptedAge} onToggle={() => setAcceptedAge((v) => !v)} colors={colors}>
              <Text style={[styles.checkText, { color: colors.foreground }]}>Imam najmanje 18 godina</Text>
            </CheckRow>
          </View>

          <Pressable
            onPress={handleRegister}
            disabled={!canRegister || loading}
            style={({ pressed }) => [
              styles.registerBtn,
              {
                backgroundColor: canRegister ? colors.primary : colors.muted,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={[styles.registerBtnText, { color: canRegister ? colors.primaryForeground : colors.mutedForeground }]}>
              {loading ? "Učitavanje..." : "Registriraj se besplatno"}
            </Text>
          </Pressable>
        </View>

        {/* Footer note */}
        <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>
          Trampaj.hr ne pohrani financijske podatke niti lozinke.{"\n"}
          Svi osobni podaci mogu se u svakom trenutku obrisati u postavkama profila.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function CheckRow({
  checked,
  onToggle,
  colors,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.checkRow}>
      <Pressable onPress={onToggle} hitSlop={8}>
        <View
          style={[
            styles.checkbox,
            {
              backgroundColor: checked ? colors.primary : colors.muted,
              borderColor: checked ? colors.primary : colors.border,
            },
          ]}
        >
          {checked && <Feather name="check" size={12} color={colors.primaryForeground} />}
        </View>
      </Pressable>
      <View style={styles.checkContent}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { paddingHorizontal: 20, gap: 24 },
  logoWrap: { alignItems: "center", gap: 10, paddingVertical: 8 },
  logoIcon: { width: 64, height: 64, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  logoText: { fontSize: 32, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  tagline: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  card: { borderRadius: 20, borderWidth: 1, padding: 20, gap: 16 },
  cardTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  cardSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: -8, lineHeight: 18 },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.4 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, fontSize: 15, fontFamily: "Inter_400Regular" },
  checkboxSection: { gap: 12 },
  checkRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0 },
  checkContent: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 2 },
  checkText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  checkLink: { fontFamily: "Inter_600SemiBold" },
  registerBtn: { paddingVertical: 15, borderRadius: 14, alignItems: "center" },
  registerBtnText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  footerNote: { fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 16, paddingHorizontal: 8 },
});
