import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CATEGORIES, CURRENCIES, useListings } from "@/context/ListingsContext";
import { useColors } from "@/hooks/useColors";

const LOCATION_OPTIONS = ["Zagreb", "Split", "Rijeka", "Osijek", "Sarajevo", "Beograd", "Ljubljana", "Ostalo"];

export default function PostScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addListing, myName } = useListings();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [wantedFor, setWantedFor] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [priceText, setPriceText] = useState("");
  const [currency, setCurrency] = useState("KM");
  const [phone, setPhone] = useState("");
  const [showPhone, setShowPhone] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 16);

  const isValid = title.trim() && description.trim() && wantedFor.trim() && category && location;

  function handleSubmit() {
    if (!isValid) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const priceNum = priceText.trim() ? parseFloat(priceText.replace(",", ".")) : null;
    addListing({
      title: title.trim(),
      description: description.trim(),
      wantedFor: wantedFor.trim(),
      category,
      location,
      price: priceNum && !isNaN(priceNum) ? priceNum : null,
      currency,
      phone: showPhone && phone.trim() ? phone.trim() : null,
    });
    setSubmitted(true);
    setTimeout(() => {
      setTitle(""); setDescription(""); setWantedFor("");
      setCategory(""); setLocation(""); setPriceText("");
      setCurrency("KM"); setPhone(""); setShowPhone(false);
      setSubmitted(false);
      router.push("/(tabs)/");
    }, 1200);
  }

  const inputStyle = [styles.input, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }];

  return (
    <KeyboardAwareScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad, paddingBottom: bottomPad + 80 }]}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View style={[styles.logoIcon, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Feather name="refresh-cw" size={20} color={colors.primary} />
        </View>
        <Text style={[styles.heading, { color: colors.foreground }]}>Objavi oglas</Text>
      </View>

      <View style={[styles.formCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.imageUploadRow}>
          <View style={[styles.imageUpload, { backgroundColor: colors.muted, borderColor: colors.secondary }]}>
            <Feather name="camera" size={28} color={colors.secondary} />
          </View>
          <View style={styles.titleDescCol}>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Unesi naslov"
              placeholderTextColor={colors.mutedForeground}
              style={[inputStyle, styles.titleInput]}
              maxLength={80}
            />
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Opis"
              placeholderTextColor={colors.mutedForeground}
              style={[inputStyle, styles.descInput]}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
          </View>
        </View>

        <TextInput
          value={wantedFor}
          onChangeText={setWantedFor}
          placeholder="Što želiš zauzvrat"
          placeholderTextColor={colors.mutedForeground}
          style={inputStyle}
          maxLength={120}
        />

        <View style={styles.priceRow}>
          <TextInput
            value={priceText}
            onChangeText={(t) => setPriceText(t.replace(/[^0-9.,]/g, ""))}
            placeholder="Cijena (opcionalno)"
            placeholderTextColor={colors.mutedForeground}
            style={[inputStyle, { flex: 1 }]}
            keyboardType="decimal-pad"
            maxLength={10}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.currencyScroll}>
            {CURRENCIES.map((cur) => (
              <Pressable
                key={cur}
                onPress={() => setCurrency(cur)}
                style={[
                  styles.currencyChip,
                  {
                    backgroundColor: currency === cur ? colors.primary : colors.muted,
                    borderColor: currency === cur ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.currencyText, { color: currency === cur ? colors.primaryForeground : colors.mutedForeground }]}>
                  {cur}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowPhone(!showPhone); }}
          style={styles.checkboxRow}
        >
          <View style={[styles.checkbox, { borderColor: showPhone ? colors.secondary : colors.border, backgroundColor: showPhone ? colors.secondary : "transparent" }]}>
            {showPhone && <Feather name="check" size={12} color={colors.secondaryForeground} />}
          </View>
          <Text style={[styles.checkboxLabel, { color: colors.foreground }]}>Prikaži broj telefona</Text>
        </Pressable>

        {showPhone && (
          <TextInput
            value={phone}
            onChangeText={setPhone}
            placeholder="npr. 091 123 4567"
            placeholderTextColor={colors.mutedForeground}
            style={inputStyle}
            keyboardType="phone-pad"
            maxLength={20}
          />
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Kategorija</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {CATEGORIES.filter((c) => c !== "Sve").map((cat) => (
              <Pressable
                key={cat}
                onPress={() => setCategory(cat)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: category === cat ? colors.primary : colors.muted,
                    borderColor: category === cat ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: category === cat ? colors.primaryForeground : colors.mutedForeground }]}>
                  {cat}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Lokacija</Text>
          <View style={styles.locationGrid}>
            {LOCATION_OPTIONS.map((loc) => (
              <Pressable
                key={loc}
                onPress={() => setLocation(loc)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: location === loc ? colors.primary : colors.muted,
                    borderColor: location === loc ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: location === loc ? colors.primaryForeground : colors.mutedForeground }]}>
                  {loc}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <Pressable
        onPress={handleSubmit}
        disabled={!isValid || submitted}
        style={({ pressed }) => [
          styles.submitBtn,
          {
            backgroundColor: submitted ? "#2E7D4F" : isValid ? colors.primary : colors.muted,
            borderColor: submitted ? "#2E7D4F" : isValid ? colors.primary : colors.border,
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
        ]}
      >
        <Feather
          name={submitted ? "check" : "plus"}
          size={18}
          color={isValid ? colors.primaryForeground : colors.mutedForeground}
        />
        <Text style={[styles.submitText, { color: isValid ? colors.primaryForeground : colors.mutedForeground }]}>
          {submitted ? "Oglas objavljen!" : "Objavi oglas"}
        </Text>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingBottom: 4,
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heading: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  formCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 12,
  },
  imageUploadRow: {
    flexDirection: "row",
    gap: 12,
  },
  imageUpload: {
    width: 90,
    height: 90,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  titleDescCol: {
    flex: 1,
    gap: 8,
  },
  titleInput: {
    flex: 0,
  },
  descInput: {
    flex: 1,
    minHeight: 52,
    paddingTop: 10,
    textAlignVertical: "top",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  currencyScroll: {
    flexShrink: 1,
  },
  currencyChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 6,
  },
  currencyText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  section: { gap: 8 },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  chips: { gap: 8, paddingRight: 4 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  locationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1.5,
  },
  submitText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
});
