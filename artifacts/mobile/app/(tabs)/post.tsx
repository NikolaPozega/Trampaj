import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { compressImage } from "@/utils/compressImage";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
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
import { CATEGORIES, CONDITIONS, CONDITION_COLORS, type Condition, useListings } from "@/context/ListingsContext";
import { useColors } from "@/hooks/useColors";
import { analyzeImageForCategory, detectCategoryFromTitle, detectCategoryLocally } from "@/services/openai";

interface LocationResult { label: string; lat: number; lon: number; }

async function searchLocations(query: string): Promise<LocationResult[]> {
  if (query.trim().length < 2) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1&countrycodes=hr,ba,rs,si,me,mk`;
    const res = await fetch(url, { headers: { "Accept-Language": "hr,en" } });
    const data: Array<{ display_name: string; address: Record<string, string>; lat: string; lon: string }> = await res.json();
    const seen = new Set<string>();
    const results: LocationResult[] = [];
    for (const item of data) {
      const a = item.address;
      const city = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? "";
      const country = a.country ?? "";
      const label = city && country ? `${city}, ${country}` : item.display_name.split(",").slice(0, 2).join(",").trim();
      if (label && !seen.has(label)) {
        seen.add(label);
        results.push({ label, lat: parseFloat(item.lat), lon: parseFloat(item.lon) });
      }
    }
    return results;
  } catch {
    return [];
  }
}

export default function PostScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addListing, listings } = useListings();

  const MAX_IMAGES = 5;
  const [imageUris, setImageUris] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [wantedFor, setWantedFor] = useState("");
  const [category, setCategory] = useState("");
  const [location, setLocation] = useState("");
  const [priceText, setPriceText] = useState("");
  const [phone, setPhone] = useState("");
  const [condition, setCondition] = useState<Condition | null>(null);
  const [locationSuggestions, setLocationSuggestions] = useState<LocationResult[]>([]);
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationFocused, setLocationFocused] = useState(false);
  const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showPhone, setShowPhone] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [categoryManuallySet, setCategoryManuallySet] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [titleSuggesting, setTitleSuggesting] = useState(false);
  const titleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wantedDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 16);

  const isValid = title.trim() && description.trim() && wantedFor.trim() && category && location;

  useEffect(() => {
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    if (title.trim().length < 3) return;
    titleDebounceRef.current = setTimeout(async () => {
      setTitleSuggesting(true);
      try {
        const detected = await detectCategoryFromTitle(title);
        if (detected && !categoryManuallySet) {
          setCategory(detected);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        }
      } catch {
        // silent
      } finally {
        setTitleSuggesting(false);
      }
    }, 800);
    return () => { if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current); };
  }, [title]);

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
        allowsEditing: true,
        aspect: [4, 3],
      });
    }

    if (!result.canceled && result.assets[0]) {
      const isFirst = imageUris.length === 0;
      const compressed = await compressImage(result.assets[0].uri, 800, 0.65);
      setImageUris((prev) => (prev.length < MAX_IMAGES ? [...prev, compressed.uri] : prev));
      if (isFirst && compressed.base64) {
        setAnalyzing(true);
        try {
          const ai = await analyzeImageForCategory(compressed.base64);
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

  function removeImage(index: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setImageUris((prev) => prev.filter((_, i) => i !== index));
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
      condition,
      price: priceNum && !isNaN(priceNum) ? priceNum : null,
      imageUris,
      phone: showPhone && phone.trim() ? phone.trim() : null,
    });

    setSubmitted(true);

    setTimeout(() => {
      setTitle(""); setDescription(""); setWantedFor("");
      setCategory(""); setLocation(""); setPriceText("");
      setPhone(""); setShowPhone(false); setImageUris([]);
      setCondition(null); setLocationSuggestions([]);
      setSubmitted(false);
      router.push("/(tabs)/");
    }, 1500);
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
        {/* ── Slike ── */}
        <View style={styles.imageSectionHeader}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Slike</Text>
          <Text style={[styles.imageCountBadge, { color: colors.mutedForeground }]}>{imageUris.length}/{MAX_IMAGES}</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageStrip}>
          {imageUris.map((uri, i) => (
            <View key={i} style={styles.imageThumb}>
              <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
              {i === 0 && (
                <View style={[styles.mainBadge, { backgroundColor: colors.primary + "DD" }]}>
                  <Text style={styles.mainBadgeText}>Naslovna</Text>
                </View>
              )}
              <Pressable hitSlop={6} style={styles.removeBtn} onPress={() => removeImage(i)}>
                <Feather name="x" size={11} color="#fff" />
              </Pressable>
            </View>
          ))}
          {imageUris.length < MAX_IMAGES && (
            <Pressable
              style={({ pressed }) => [
                styles.imageThumbAdd,
                { borderColor: analyzing ? colors.primary : colors.secondary, opacity: pressed ? 0.7 : 1 },
              ]}
              onPress={showImagePicker}
            >
              {analyzing
                ? <ActivityIndicator size="small" color={colors.primary} />
                : <Feather name="plus" size={24} color={colors.secondary} />}
              <Text style={[styles.imageAddLabel, { color: colors.mutedForeground }]}>
                {imageUris.length === 0 ? "Dodaj\nsliku" : "Još"}
              </Text>
            </Pressable>
          )}
        </ScrollView>

        {analyzing && (
          <View style={[styles.aiBanner, { backgroundColor: colors.muted, borderColor: colors.primary }]}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.aiText, { color: colors.primary }]}>AI prepoznaje predmet...</Text>
          </View>
        )}

        {/* ── Naslov + Opis ── */}
        <View style={styles.titleWrapper}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Unesi naslov"
            placeholderTextColor={colors.mutedForeground}
            style={[inputStyle, styles.titleInput]}
            maxLength={80}
          />
          {titleSuggesting && (
            <View style={styles.titleAiDot}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          )}
        </View>
        <TextInput
          value={description}
          onChangeText={setDescription}
          placeholder="Opis predmeta..."
          placeholderTextColor={colors.mutedForeground}
          style={[inputStyle, styles.descInput]}
          multiline
          maxLength={500}
          textAlignVertical="top"
        />

        <TextInput
          value={wantedFor}
          onChangeText={(t) => { setWantedFor(t); }}
          placeholder="Što želiš zauzvrat (npr. bicikl, laptop…)"
          placeholderTextColor={colors.mutedForeground}
          style={inputStyle}
          maxLength={120}
        />

        <WantedSuggestions
          wantedFor={wantedFor}
          priceText={priceText}
          listings={listings}
          colors={colors}
        />

        <View style={styles.priceRow}>
          <View style={[styles.euroPrefix, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Text style={[styles.euroPrefixText, { color: colors.primary }]}>€</Text>
          </View>
          <TextInput
            value={priceText}
            onChangeText={(t) => setPriceText(t.replace(/[^0-9.,]/g, ""))}
            placeholder="Vrijednost u € (opcionalno)"
            placeholderTextColor={colors.mutedForeground}
            style={[inputStyle, { flex: 1 }]}
            keyboardType="decimal-pad"
            maxLength={10}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Stanje predmeta</Text>
          <View style={styles.conditionGrid}>
            {CONDITIONS.map((cond) => {
              const col = CONDITION_COLORS[cond];
              const selected = condition === cond;
              return (
                <Pressable
                  key={cond}
                  onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setCondition(selected ? null : cond); }}
                  style={[
                    styles.conditionChip,
                    {
                      backgroundColor: selected ? `${col}22` : colors.muted,
                      borderColor: selected ? col : colors.border,
                    },
                  ]}
                >
                  <View style={[styles.conditionDot, { backgroundColor: col }]} />
                  <Text style={[styles.conditionChipText, { color: selected ? col : colors.mutedForeground }]}>{cond}</Text>
                </Pressable>
              );
            })}
          </View>
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
                onPress={() => { setCategory(cat); setCategoryManuallySet(true); }}
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
          <View style={styles.locationWrap}>
            <View style={[
              styles.locationInputRow,
              {
                backgroundColor: colors.muted,
                borderColor: location ? colors.primary : locationFocused ? colors.secondary : colors.border,
              },
            ]}>
              <Feather name="map-pin" size={16} color={location ? colors.primary : colors.mutedForeground} />
              <TextInput
                value={location}
                onChangeText={(v) => {
                  setLocation(v);
                  if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
                  if (v.trim().length >= 2) {
                    setLocationLoading(true);
                    locationDebounceRef.current = setTimeout(async () => {
                      try {
                        const results = await searchLocations(v);
                        setLocationSuggestions(results);
                      } catch {
                        setLocationSuggestions([]);
                      } finally {
                        setLocationLoading(false);
                      }
                    }, 420);
                  } else {
                    setLocationSuggestions([]);
                    setLocationLoading(false);
                  }
                }}
                onFocus={() => setLocationFocused(true)}
                onBlur={() => setTimeout(() => { setLocationFocused(false); }, 180)}
                placeholder="Upiši grad ili adresu…"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.locationInput, { color: colors.foreground }]}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {locationLoading
                ? <ActivityIndicator size="small" color={colors.primary} />
                : location
                  ? <Pressable hitSlop={8} onPress={() => { setLocation(""); setLocationSuggestions([]); setLocationCoords(null); }}>
                      <Feather name="x" size={15} color={colors.mutedForeground} />
                    </Pressable>
                  : null}
            </View>
            {locationFocused && locationSuggestions.length > 0 && (
              <View style={[styles.locationDropdown, { backgroundColor: colors.card, borderColor: colors.border }]}>
                {locationSuggestions.map((s, i) => (
                  <Pressable
                    key={i}
                    onPress={() => {
                      setLocation(s.label);
                      setLocationCoords({ lat: s.lat, lon: s.lon });
                      setLocationSuggestions([]);
                      setLocationFocused(false);
                    }}
                    style={({ pressed }) => [
                      styles.locationSuggItem,
                      i > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
                      { backgroundColor: pressed ? colors.muted : "transparent" },
                    ]}
                  >
                    <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                    <Text style={[styles.locationSuggText, { color: colors.foreground }]} numberOfLines={1}>{s.label}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {locationCoords && !locationFocused && (
              <Pressable
                onPress={() => Linking.openURL(`https://www.google.com/maps?q=${locationCoords.lat},${locationCoords.lon}`)}
                style={({ pressed }) => [styles.mapPreview, { opacity: pressed ? 0.85 : 1, borderColor: colors.border }]}
              >
                <Image
                  source={{ uri: `https://staticmap.openstreetmap.de/staticmap.php?center=${locationCoords.lat},${locationCoords.lon}&zoom=13&size=600x180&markers=${locationCoords.lat},${locationCoords.lon},red-marker` }}
                  style={styles.mapImage}
                  contentFit="cover"
                />
                <View style={[styles.mapOverlay, { backgroundColor: colors.card + "CC" }]}>
                  <Feather name="map" size={13} color={colors.secondary} />
                  <Text style={[styles.mapOverlayText, { color: colors.secondary }]}>Otvori u Google Maps</Text>
                </View>
              </Pressable>
            )}
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
        <Feather name={submitted ? "check" : "plus"} size={18} color={isValid || submitted ? colors.primaryForeground : colors.mutedForeground} />
        <Text style={[styles.submitText, { color: isValid || submitted ? colors.primaryForeground : colors.mutedForeground }]}>
          {submitted ? "Oglas objavljen!" : "Objavi oglas"}
        </Text>
      </Pressable>
    </KeyboardAwareScrollView>
  );
}

// ─── Wanted Suggestions ────────────────────────────────────────────────────

interface WantedSuggestionsProps {
  wantedFor: string;
  priceText: string;
  listings: import("@/context/ListingsContext").Listing[];
  colors: ReturnType<typeof useColors>;
}

function WantedSuggestions({ wantedFor, priceText, listings, colors }: WantedSuggestionsProps) {
  const [matches, setMatches] = React.useState<import("@/context/ListingsContext").Listing[]>([]);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const q = wantedFor.trim();
      if (q.length < 2) { setMatches([]); return; }

      const detectedCat = detectCategoryLocally(q);
      const myPrice = priceText ? parseFloat(priceText.replace(",", ".")) : null;

      // Tokenize: split into meaningful words (≥3 chars), strip diacritics for comparison
      function normalize(s: string) {
        return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      }
      function tokenize(text: string): string[] {
        return normalize(text).split(/[\s,.!?;:()\-\/\\]+/).filter(w => w.length >= 3);
      }
      // Two words match only if they share a common root — require length ratio ≥ 0.75
      // to prevent "stol"(4) matching "stolica"(7): 4/7 ≈ 0.57 < 0.75 → no match
      function wordsSimilar(a: string, b: string): boolean {
        if (a === b) return true;
        const short = a.length <= b.length ? a : b;
        const long  = a.length <= b.length ? b : a;
        if (short.length / long.length < 0.75) return false;
        const prefixLen = short.length - 1;
        return prefixLen >= 2 && a.substring(0, prefixLen) === b.substring(0, prefixLen);
      }
      function textScore(queryTokens: string[], text: string): number {
        const listingTokens = tokenize(text);
        return queryTokens.reduce((sum, qt) =>
          sum + (listingTokens.some(lt => wordsSimilar(qt, lt)) ? 1 : 0), 0);
      }

      const queryTokens = tokenize(q);
      let candidates = listings.filter((l) => l.status === "active" && !l.isMine);

      // Score each candidate: category match + word overlap in title/description
      const scored = candidates.map((l) => {
        const catMatch = detectedCat ? (l.category === detectedCat ? 2 : 0) : 0;
        const combinedText = l.title + " " + l.description + " " + l.wantedFor;
        const wordScore = textScore(queryTokens, combinedText) * 3;
        return { l, score: catMatch + wordScore };
      }).filter(({ score }) => score > 0);

      // Sort by score desc, then price proximity
      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (myPrice == null) return 0;
        const aDiff = a.l.price != null ? Math.abs(a.l.price - myPrice) : Infinity;
        const bDiff = b.l.price != null ? Math.abs(b.l.price - myPrice) : Infinity;
        return aDiff - bDiff;
      });

      setMatches(scored.slice(0, 8).map(({ l }) => l));
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [wantedFor, priceText, listings]);

  if (matches.length === 0) return null;

  return (
    <View style={wStyles.container}>
      <View style={wStyles.header}>
        <Feather name="search" size={12} color={colors.secondary} />
        <Text style={[wStyles.label, { color: colors.secondary }]}>
          Dostupni oglasi koji odgovaraju
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={wStyles.scroll}
      >
        {matches.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => router.push(`/listing/${item.id}`)}
            style={({ pressed }) => [
              wStyles.card,
              { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <View style={[wStyles.catBadge, { backgroundColor: colors.muted }]}>
              <Text style={[wStyles.catText, { color: colors.mutedForeground }]}>{item.category}</Text>
            </View>
            <Text style={[wStyles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
              {item.title}
            </Text>
            {item.price != null && (
              <Text style={[wStyles.cardPrice, { color: colors.primary }]}>
                {item.price} €
              </Text>
            )}
            <Text style={[wStyles.cardSub, { color: colors.mutedForeground }]} numberOfLines={1}>
              {item.location}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const wStyles = StyleSheet.create({
  container: { gap: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 5 },
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.3, textTransform: "uppercase" },
  scroll: { gap: 8, paddingRight: 4 },
  card: {
    width: 130,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 5,
  },
  catBadge: { alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  catText: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.2, textTransform: "uppercase" },
  cardTitle: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 16 },
  cardPrice: { fontSize: 13, fontFamily: "Inter_700Bold" },
  cardSub: { fontSize: 10, fontFamily: "Inter_400Regular" },
});

// ─────────────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 4 },
  logoIcon: { width: 40, height: 40, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  heading: { fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.5 },
  formCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 12 },
  imageSectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  imageCountBadge: { fontSize: 12, fontFamily: "Inter_500Medium" },
  imageStrip: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  imageThumb: { width: 88, height: 88, borderRadius: 12, overflow: "hidden", position: "relative", flexShrink: 0 },
  mainBadge: { position: "absolute", bottom: 0, left: 0, right: 0, paddingVertical: 3, alignItems: "center" },
  mainBadgeText: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "#fff" },
  removeBtn: { position: "absolute", top: 5, right: 5, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 10, padding: 3 },
  imageThumbAdd: {
    width: 88,
    height: 88,
    borderRadius: 12,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    flexShrink: 0,
  },
  imageAddLabel: { fontSize: 10, fontFamily: "Inter_500Medium", textAlign: "center" },
  aiBanner: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: 10, borderWidth: 1 },
  aiText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  titleInput: { flex: 0 },
  titleWrapper: { position: "relative" },
  titleAiDot: { position: "absolute", right: 10, top: 0, bottom: 0, justifyContent: "center" },
  descInput: { minHeight: 52, paddingTop: 10, textAlignVertical: "top" },
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
  locationWrap: { position: "relative" },
  locationInputRow: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  locationInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  locationDropdown: { borderWidth: 1, borderRadius: 10, marginTop: 4, overflow: "hidden" },
  locationSuggItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  locationSuggText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1 },
  mapPreview: { marginTop: 8, borderRadius: 10, overflow: "hidden", borderWidth: 1, height: 140 },
  mapImage: { width: "100%", height: "100%" },
  mapOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 7 },
  mapOverlayText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  conditionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  conditionChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, borderWidth: 1.5 },
  conditionDot: { width: 8, height: 8, borderRadius: 4 },
  conditionChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  suggestCard: { borderRadius: 14, borderWidth: 1.5, padding: 14, gap: 10 },
  suggestHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  suggestTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  suggestItem: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 8, borderTopWidth: 1 },
  suggestItemText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  suggestItemSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 14, paddingVertical: 16, gap: 8, borderWidth: 1.5 },
  submitText: { fontSize: 16, fontFamily: "Inter_700Bold" },
});
