import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { analyzeImageForCategory, suggestTrades } from "@/services/openai";

const LOCATION_OPTIONS = ["Zagreb", "Split", "Rijeka", "Osijek", "Sarajevo", "Beograd", "Ljubljana", "Ostalo"];

export default function PostScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addListing, listings } = useListings();

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [wantedFor, setWantedFor] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [priceText, setPriceText] = useState("");
  const [phone, setPhone] = useState("");
  const [showPhone, setShowPhone] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 16);

  const isValid = title.trim() && description.trim() && wantedFor.trim() && category && location;

  async function pickImage(fromCamera: boolean) {
    let result;
    const isWeb = Platform.OS === "web";

    if (fromCamera && !isWeb) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert("Dozvola potrebna", "Potrebna je dozvola za kameru.");
        return;
      }
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: "images",
        quality: 0.7,
        base64: true,
        allowsEditing: true,
        aspect: [4, 3],
      });
    } else {
      if (!isWeb) {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Dozvola potrebna", "Potrebna je dozvola za galeriju.");
          return;
        }
      }
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: "images",
        quality: 0.7,
        base64: true,
        allowsEditing: true,
        aspect: [4, 3],
      });
    }

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      if (asset.base64) {
        setAnalyzing(true);
        try {
          const ai = await analyzeImageForCategory(asset.base64);
          if (ai.category) setCategory(ai.category);
          if (ai.title && !title) setTitle(ai.title);
          if (ai.description && !description) setDescription(ai.description);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch {
          // silent — user can fill manually
        } finally {
          setAnalyzing(false);
        }
      }
    }
  }

  function showImagePicker() {
    if (Platform.OS === "web") {
      pickImage(false);
      return;
    }
    Alert.alert("Dodaj sliku", "Odaberi izvor", [
      { text: "Kamera", onPress: () => pickImage(true) },
      { text: "Galerija", onPress: () => pickImage(false) },
      { text: "Odustani", style: "cancel" },
    ]);
  }

  async function handleSubmit() {
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
      imageUri,
      phone: showPhone && phone.trim() ? phone.trim() : null,
    });

    setSubmitted(true);

    // AI prijedlozi zamjene u pozadini
    setLoadingSuggestions(true);
    try {
      const others = listings.filter((l) => l.status === "active" && !l.isMine);
      const ids = await suggestTrades({ title: title.trim(), category, wantedFor: wantedFor.trim() }, others);
      setAiSuggestions(ids);
    } catch {
      // silent
    } finally {
      setLoadingSuggestions(false);
    }

    setTimeout(() => {
      setTitle(""); setDescription(""); setWantedFor("");
      setCategory(""); setLocation(""); setPriceText("");
      setPhone(""); setShowPhone(false); setImageUri(null);
      setSubmitted(false); setAiSuggestions([]);
      router.push("/(tabs)/");
    }, aiSuggestions.length > 0 ? 3000 : 1500);
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
          <Pressable
            onPress={showImagePicker}
            style={({ pressed }) => [
              styles.imageUpload,
              { backgroundColor: colors.muted, borderColor: analyzing ? colors.primary : colors.secondary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : analyzing ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <Feather name="camera" size={26} color={colors.secondary} />
            )}
            {analyzing && (
              <View style={[styles.analyzingOverlay, { backgroundColor: "rgba(8,21,46,0.7)" }]}>
                <Text style={[styles.analyzingText, { color: colors.primary }]}>AI analiza...</Text>
              </View>
            )}
            {imageUri && !analyzing && (
              <View style={styles.editImageBadge}>
                <Feather name="camera" size={12} color="#fff" />
              </View>
            )}
          </Pressable>

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

        {analyzing && (
          <View style={[styles.aiBanner, { backgroundColor: colors.muted, borderColor: colors.primary }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.aiText, { color: colors.primary }]}>AI prepoznaje predmet...</Text>
          </View>
        )}

        <TextInput
          value={wantedFor}
          onChangeText={setWantedFor}
          placeholder="Što želiš zauzvrat"
          placeholderTextColor={colors.mutedForeground}
          style={inputStyle}
          maxLength={120}
        />

        <View style={styles.priceRow}>
          <View style={[styles.euroPrefix, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Text style={[styles.euroPrefixText, { color: colors.primary }]}>€</Text>
          </View>
          <TextInput
            value={priceText}
            onChangeText={(t) => setPriceText(t.replace(/[^0-9.,]/g, ""))}
            placeholder="Cijena (opcionalno)"
            placeholderTextColor={colors.mutedForeground}
            style={[inputStyle, { flex: 1 }]}
            keyboardType="decimal-pad"
            maxLength={10}
          />
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
                  { backgroundColor: category === cat ? colors.primary : colors.muted, borderColor: category === cat ? colors.primary : colors.border },
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
                  { backgroundColor: location === loc ? colors.primary : colors.muted, borderColor: location === loc ? colors.primary : colors.border },
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

      {submitted && aiSuggestions.length > 0 && (
        <View style={[styles.suggestCard, { backgroundColor: colors.card, borderColor: colors.primary }]}>
          <View style={styles.suggestHeader}>
            <Feather name="zap" size={14} color={colors.primary} />
            <Text style={[styles.suggestTitle, { color: colors.primary }]}>AI prijedlozi zamjene</Text>
          </View>
          {aiSuggestions.map((id) => {
            const l = listings.find((x) => x.id === id);
            if (!l) return null;
            return (
              <View key={id} style={[styles.suggestItem, { borderColor: colors.border }]}>
                <Feather name="refresh-cw" size={12} color={colors.secondary} />
                <Text style={[styles.suggestItemText, { color: colors.foreground }]} numberOfLines={1}>{l.title}</Text>
                <Text style={[styles.suggestItemSub, { color: colors.mutedForeground }]}>{l.location}</Text>
              </View>
            );
          })}
        </View>
      )}

      {submitted && loadingSuggestions && (
        <View style={[styles.suggestCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.suggestHeader}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.suggestTitle, { color: colors.mutedForeground }]}>AI traži prijedloge zamjene...</Text>
          </View>
        </View>
      )}

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
        <Feather name={submitted ? "check" : "plus"} size={18} color={isValid || submitted ? colors.primaryForeground : colors.mutedForeground} />
        <Text style={[styles.submitText, { color: isValid || submitted ? colors.primaryForeground : colors.mutedForeground }]}>
          {submitted ? "Oglas objavljen!" : "Objavi oglas"}
        </Text>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 4 },
  logoIcon: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  heading: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  formCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  imageUploadRow: { flexDirection: "row", gap: 12 },
  imageUpload: {
    width: 92,
    height: 92,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    overflow: "hidden",
  },
  analyzingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  analyzingText: { fontSize: 10, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  editImageBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 10,
    padding: 4,
  },
  aiBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  aiText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  titleDescCol: { flex: 1, gap: 8 },
  titleInput: { flex: 0 },
  descInput: { flex: 1, minHeight: 52, paddingTop: 10, textAlignVertical: "top" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  euroPrefix: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, alignItems: "center", justifyContent: "center" },
  euroPrefixText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  checkboxLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },
  section: { gap: 8 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5, textTransform: "uppercase" },
  chips: { gap: 8, paddingRight: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  locationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestCard: { borderRadius: 14, borderWidth: 1.5, padding: 14, gap: 10 },
  suggestHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  suggestTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  suggestItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8, borderTopWidth: 1 },
  suggestItemText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  suggestItemSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 14, paddingVertical: 16, gap: 8, borderWidth: 1.5 },
  submitText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
