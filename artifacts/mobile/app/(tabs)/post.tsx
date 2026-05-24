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
import { CATEGORIES, useListings } from "@/context/ListingsContext";
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
  const [submitted, setSubmitted] = useState(false);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 16);

  const isValid = title.trim() && description.trim() && wantedFor.trim() && category && location;

  function handleSubmit() {
    if (!isValid) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    addListing({ title: title.trim(), description: description.trim(), wantedFor: wantedFor.trim(), category, location });
    setSubmitted(true);
    setTimeout(() => {
      setTitle("");
      setDescription("");
      setWantedFor("");
      setCategory("");
      setLocation("");
      setSubmitted(false);
      router.push("/(tabs)/");
    }, 1200);
  }

  return (
    <KeyboardAwareScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: topPad + 16, paddingBottom: bottomPad + 80 }]}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.heading, { color: colors.foreground }]}>Novi oglas</Text>
      <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
        Postavljaš oglas kao: {myName}
      </Text>

      <View style={styles.section}>
        <Label colors={colors}>Naziv predmeta</Label>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="npr. Sony slušalice, bicikl, jakna..."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          maxLength={80}
        />
      </View>

      <View style={styles.section}>
        <Label colors={colors}>Opis</Label>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Opiši predmet, stanje, detalje..."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, styles.textArea, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          multiline
          maxLength={500}
          textAlignVertical="top"
        />
      </View>

      <View style={styles.section}>
        <Label colors={colors}>Što tražiš u zamjenu?</Label>
        <TextInput
          value={wantedFor}
          onChangeText={setWantedFor}
          placeholder="npr. laptop, knjige, sportska oprema..."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
          maxLength={120}
        />
      </View>

      <View style={styles.section}>
        <Label colors={colors}>Kategorija</Label>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {CATEGORIES.filter((c) => c !== "Sve").map((cat) => (
            <Pressable
              key={cat}
              onPress={() => setCategory(cat)}
              style={({ pressed }) => [
                styles.chip,
                {
                  backgroundColor: category === cat ? colors.primary : colors.card,
                  borderColor: category === cat ? colors.primary : colors.border,
                  opacity: pressed ? 0.8 : 1,
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
        <Label colors={colors}>Lokacija</Label>
        <View style={styles.locationGrid}>
          {LOCATION_OPTIONS.map((loc) => (
            <Pressable
              key={loc}
              onPress={() => setLocation(loc)}
              style={({ pressed }) => [
                styles.locationChip,
                {
                  backgroundColor: location === loc ? colors.primary : colors.card,
                  borderColor: location === loc ? colors.primary : colors.border,
                  opacity: pressed ? 0.8 : 1,
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

      <Pressable
        onPress={handleSubmit}
        disabled={!isValid || submitted}
        style={({ pressed }) => [
          styles.submitBtn,
          {
            backgroundColor: submitted ? colors.secondary : isValid ? colors.primary : colors.muted,
            opacity: pressed ? 0.88 : 1,
            transform: [{ scale: pressed ? 0.97 : 1 }],
          },
        ]}
      >
        <Feather
          name={submitted ? "check" : "plus"}
          size={18}
          color={isValid ? "#fff" : colors.mutedForeground}
        />
        <Text
          style={[
            styles.submitText,
            { color: isValid ? "#fff" : colors.mutedForeground },
          ]}
        >
          {submitted ? "Oglas objavljen!" : "Objavi oglas"}
        </Text>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

function Label({ children, colors }: { children: string; colors: ReturnType<typeof useColors> }) {
  return (
    <Text style={[labelStyles.label, { color: colors.foreground }]}>{children}</Text>
  );
}

const labelStyles = StyleSheet.create({
  label: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
  },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 20 },
  heading: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  subheading: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginBottom: 4,
  },
  section: { gap: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  textArea: {
    height: 100,
    paddingTop: 12,
  },
  chips: {
    gap: 8,
    paddingRight: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  locationGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  locationChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    paddingVertical: 15,
    gap: 8,
    marginTop: 8,
  },
  submitText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
});
