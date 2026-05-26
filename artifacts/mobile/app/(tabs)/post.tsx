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
import {
  CONDITIONS,
  CONDITION_COLORS,
  type Condition,
  type Deadline,
  type Flexibility,
  type PackageBoxSize,
  type PackageSize,
  type Topup,
  useListings,
} from "@/context/ListingsContext";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import {
  analyzeImageForCategory,
  detectCategoryFromTitle,
  detectCategoryLocally,
  generateListingTags,
  moderateText,
  moderateImage,
} from "@/services/openai";

interface LocationResult {
  label: string;
  lat: number;
  lon: number;
}

async function searchLocations(query: string): Promise<LocationResult[]> {
  if (query.trim().length < 2) return [];
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&addressdetails=1&countrycodes=hr,ba,rs,si,me,mk`;
    const res = await fetch(url, { headers: { "Accept-Language": "hr,en" } });
    const data: Array<{
      display_name: string;
      address: Record<string, string>;
      lat: string;
      lon: string;
    }> = await res.json();
    const seen = new Set<string>();
    const results: LocationResult[] = [];
    for (const item of data) {
      const a = item.address;
      const city =
        a.city ?? a.town ?? a.village ?? a.municipality ?? a.county ?? "";
      const country = a.country ?? "";
      const street =
        a.road ?? a.pedestrian ?? a.footway ?? a.street ?? "";
      const houseNum = a.house_number ?? "";
      const streetFull = [houseNum, street].filter(Boolean).join(" ");
      const label = streetFull
        ? `${streetFull}, ${city}`.trim().replace(/^,\s*/, "")
        : city && country
          ? `${city}, ${country}`
          : item.display_name.split(",").slice(0, 3).join(",").trim();
      if (label && !seen.has(label)) {
        seen.add(label);
        results.push({
          label,
          lat: parseFloat(item.lat),
          lon: parseFloat(item.lon),
        });
      }
    }
    return results;
  } catch {
    return [];
  }
}

// ─── Generic chip group ───────────────────────────────────────────────────────

interface ChipOption<T> {
  key: T;
  label: string;
}

interface ChipGroupProps<T extends string> {
  label: string;
  options: ChipOption<T>[];
  value: T | null;
  onSelect: (v: T) => void;
  required?: boolean;
  colors: ReturnType<typeof useColors>;
}

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onSelect,
  required,
  colors,
}: ChipGroupProps<T>) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionLabelRow}>
        <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
          {label}
        </Text>
        {required && !value && (
          <Text style={[styles.requiredTag, { color: colors.destructive }]}>
            obvezno
          </Text>
        )}
      </View>
      <View style={styles.chipWrap}>
        {options.map((opt) => {
          const selected = value === opt.key;
          return (
            <Pressable
              key={opt.key}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onSelect(opt.key);
              }}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.primary : colors.muted,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: selected
                      ? colors.primaryForeground
                      : colors.mutedForeground,
                  },
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({
  icon,
  title,
  children,
  colors,
}: {
  icon: keyof typeof Feather.glyphMap;
  title: string;
  children: React.ReactNode;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View style={styles.cardHeader}>
        <View
          style={[
            styles.cardIconWrap,
            { backgroundColor: colors.primary + "22" },
          ]}
        >
          <Feather name={icon} size={14} color={colors.primary} />
        </View>
        <Text style={[styles.cardTitle, { color: colors.foreground }]}>
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function PostScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { addListing, listings } = useListings();
  const { user } = useAuth();

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
  const [topup, setTopup] = useState<Topup | null>(null);
  const [flexibility, setFlexibility] = useState<Flexibility | null>(null);
  const [cashFallback, setCashFallback] = useState<boolean | null>(null);
  const [deadline, setDeadline] = useState<Deadline | null>(null);
  const [packageSize, setPackageSize] = useState<PackageSize | null>(null);
  const [packageBoxSize, setPackageBoxSize] = useState<PackageBoxSize | null>(null);
  const [packageWeight, setPackageWeight] = useState<string>("");
  const [locationSuggestions, setLocationSuggestions] = useState<
    LocationResult[]
  >([]);
  const [locationCoords, setLocationCoords] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationFocused, setLocationFocused] = useState(false);
  const locationDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const [showPhone, setShowPhone] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [categoryManuallySet, setCategoryManuallySet] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [moderating, setModerating] = useState(false);
  const [titleSuggesting, setTitleSuggesting] = useState(false);
  const titleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track whether AI filled title/description (so we know if user overrode it)
  const titleFromAI = useRef(false);
  const descriptionFromAI = useRef(false);
  const [titleAIBadge, setTitleAIBadge] = useState(false);
  const [descriptionAIBadge, setDescriptionAIBadge] = useState(false);

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 16);

  const requiredFields = [
    title.trim().length > 0,
    description.trim().length > 0,
    wantedFor.trim().length > 0,
    condition !== null,
    location.trim().length > 0,
    topup !== null,
    cashFallback !== null,
    deadline !== null,
    flexibility !== null,
  ];
  const filledCount = requiredFields.filter(Boolean).length;
  const TOTAL_REQUIRED = requiredFields.length;
  const isValid = filledCount === TOTAL_REQUIRED;

  useEffect(() => {
    if (!user || location) return;
    const parts = [user.address, user.city].filter(Boolean);
    if (parts.length) setLocation(parts.join(", "));
  }, [user, location]);

  useEffect(() => {
    if (user?.phone && !phone) setPhone(user.phone);
  }, [user]);

  useEffect(() => {
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    if (title.trim().length < 3) return;
    titleDebounceRef.current = setTimeout(async () => {
      setTitleSuggesting(true);
      try {
        const detected = await detectCategoryFromTitle(title);
        console.log("[KATEGORIJA] Detekcija za naslov:", title, "→", detected || "(nije detektirana)");
        if (detected && !categoryManuallySet) {
          setCategory(detected);
        }
      } catch {}
      finally {
        setTitleSuggesting(false);
      }
    }, 800);
    return () => {
      if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    };
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
      setImageUris((prev) =>
        prev.length < MAX_IMAGES ? [...prev, compressed.uri] : prev
      );
      if (isFirst && compressed.base64) {
        setAnalyzing(true);
        try {
          const ai = await analyzeImageForCategory(compressed.base64);
          console.log("[AI] analyzeImageForCategory rezultat:", JSON.stringify(ai));
          if (ai.category && !categoryManuallySet) setCategory(ai.category);
          // Samo upiši ako korisnik još nije ništa utipkao — ne pregazi ručni unos
          if (ai.title && !title.trim()) {
            setTitle(ai.title);
            titleFromAI.current = true;
            setTitleAIBadge(true);
            console.log("[AI] Naslov iz slike:", ai.title);
          } else if (ai.title && title.trim()) {
            console.log("[AI] Naslov preskočen (korisnik već upisao):", title.trim());
          } else {
            console.log("[AI] Naslov nije vraćen od AI");
          }
          if (ai.description && !description.trim()) {
            setDescription(ai.description);
            descriptionFromAI.current = true;
            setDescriptionAIBadge(true);
            console.log("[AI] Opis iz slike:", ai.description);
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
          console.log("[AI] analyzeImageForCategory greška:", String(err));
        }
        finally {
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

  const submittingRef = useRef(false);

  async function handleSubmit() {
    if (!isValid || submittingRef.current) return;
    submittingRef.current = true;

    // ── Provjera sadržaja ──────────────────────────────────────────────────────
    setModerating(true);
    try {
      const combinedText = [title.trim(), description.trim(), wantedFor.trim()].filter(Boolean).join(" | ");
      let imageBase64ForMod: string | undefined;
      if (imageUris.length > 0) {
        try {
          const c = await compressImage(imageUris[0], 600, 0.6);
          imageBase64ForMod = c.base64 ?? undefined;
        } catch {}
      }

      const [textMod, imgMod] = await Promise.all([
        moderateText(combinedText),
        imageBase64ForMod ? moderateImage(imageBase64ForMod) : Promise.resolve({ flagged: false, reason: undefined as string | undefined }),
      ]);

      if (textMod.flagged || imgMod.flagged) {
        const reason = textMod.flagged ? textMod.reason : imgMod.reason;
        Alert.alert(
          "Sadržaj nije prihvatljiv",
          `Oglas sadrži neprimjeren sadržaj${reason ? `: ${reason}` : ""}.\n\nMolimo prilagodi sadržaj i pokušaj ponovo.`,
          [{ text: "U redu", style: "default" }]
        );
        submittingRef.current = false;
        setModerating(false);
        return;
      }
    } catch {
      // Nastavi ako moderation API nije dostupan
    }
    setModerating(false);

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const priceNum = priceText.trim()
      ? parseFloat(priceText.replace(",", "."))
      : null;
    // Komprimiraj prvu sliku za vision AI (ako postoji)
    let imageBase64: string | undefined;
    if (imageUris.length > 0) {
      try {
        const compressed = await compressImage(imageUris[0], 900, 0.82);
        imageBase64 = compressed.base64 ?? undefined;
        console.log("[SUBMIT] Slika komprimirana za AI, base64 dužina:", imageBase64?.length ?? 0);
      } catch {
        console.log("[SUBMIT] Kompresija slike nije uspjela, nastavljam bez slike");
      }
    }
    console.log("[SUBMIT] Generiranje AI tagova za:", { title: title.trim(), description: description.trim(), wantedFor: wantedFor.trim(), imaSliku: !!imageBase64 });
    const tags = await generateListingTags(title.trim(), description.trim(), wantedFor.trim(), imageBase64);
    console.log("[SUBMIT] AI tagovi rezultat:", JSON.stringify(tags));
    // Uvijek primjeni AI ispravak tipfelera — bez obzira je li korisnik uređivao ili ne
    const finalTitle = tags.correctedTitle || title.trim();
    const finalDescription = tags.correctedDescription || description.trim();
    console.log("[SUBMIT] Finalni tekst:", { naslov: finalTitle, opis: finalDescription });
    // Ako kategorija nije detektirana iz naslova (tipfelera), pokušaj iz AI tagova
    let resolvedCategory = category;
    if (!resolvedCategory && tags.nudimTags.length > 0) {
      resolvedCategory = detectCategoryLocally(tags.nudimTags.join(" "));
      if (resolvedCategory) {
        console.log("[KATEGORIJA] Oporavak iz AI tagova →", resolvedCategory);
      }
    }
    const listing = {
      title: finalTitle,
      description: finalDescription,
      wantedFor: wantedFor.trim(),
      category: resolvedCategory,
      location,
      condition,
      price: priceNum && !isNaN(priceNum) ? priceNum : null,
      imageUris,
      phone: phone.trim() || null,
      topup,
      flexibility,
      cashFallback,
      deadline,
      nudimTags: tags.nudimTags,
      trazimTags: tags.trazimTags,
      packageSize,
      packageBoxSize: packageSize === "small" ? packageBoxSize : null,
      packageWeight: packageSize === "medium" ? (parseFloat(packageWeight) || null) : null,
    };
    console.log("[SUBMIT] Novi oglas:", JSON.stringify(listing));
    addListing(listing);
    setSubmitted(true);
    setTimeout(() => {
      const defaultLoc = user
        ? [user.address, user.city].filter(Boolean).join(", ")
        : "";
      setTitle("");
      setDescription("");
      setWantedFor("");
      setCategory("");
      setLocation(defaultLoc);
      setPriceText("");
      setPhone("");
      setShowPhone(false);
      setImageUris([]);
      setCondition(null);
      setTopup(null);
      setFlexibility(null);
      setCashFallback(null);
      setDeadline(null);
      setPackageSize(null);
      setPackageBoxSize(null);
      setPackageWeight("");
      setLocationSuggestions([]);
      setCategoryManuallySet(false);
      titleFromAI.current = false;
      descriptionFromAI.current = false;
      setTitleAIBadge(false);
      setDescriptionAIBadge(false);
      setSubmitted(false);
      submittingRef.current = false;
      router.push("/(tabs)" as never);
    }, 1500);
  }

  const inputStyle = [
    styles.input,
    {
      backgroundColor: colors.muted,
      borderColor: colors.border,
      color: colors.foreground,
    },
  ];

  return (
    <KeyboardAwareScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingTop: topPad, paddingBottom: bottomPad + 80 },
      ]}
      bottomOffset={20}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View
          style={[
            styles.logoIcon,
            { backgroundColor: colors.muted, borderColor: colors.border },
          ]}
        >
          <Feather name="refresh-cw" size={20} color={colors.primary} />
        </View>
        <View>
          <Text style={[styles.heading, { color: colors.foreground }]}>
            Objavi oglas
          </Text>
          <Text
            style={[styles.headingSub, { color: colors.mutedForeground }]}
          >
            Ispuni sva polja pa objavi
          </Text>
        </View>
      </View>

      {/* ── Kartica 1: Što nudiš ── */}
      <SectionCard icon="package" title="Što nudiš" colors={colors}>
        {/* Slike */}
        <View style={styles.imageSectionHeader}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            Slike
          </Text>
          <Text
            style={[styles.imageCountBadge, { color: colors.mutedForeground }]}
          >
            {imageUris.length}/{MAX_IMAGES}
          </Text>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.imageStrip}
        >
          {imageUris.map((uri, i) => (
            <View key={i} style={styles.imageThumb}>
              <Image
                source={{ uri }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
              {i === 0 && (
                <View
                  style={[
                    styles.mainBadge,
                    { backgroundColor: colors.primary + "DD" },
                  ]}
                >
                  <Text style={styles.mainBadgeText}>Naslovna</Text>
                </View>
              )}
              <Pressable
                hitSlop={6}
                style={styles.removeBtn}
                onPress={() => removeImage(i)}
              >
                <Feather name="x" size={11} color="#fff" />
              </Pressable>
            </View>
          ))}
          {imageUris.length < MAX_IMAGES && (
            <Pressable
              style={({ pressed }) => [
                styles.imageThumbAdd,
                {
                  borderColor: analyzing
                    ? colors.primary
                    : colors.secondary,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              onPress={showImagePicker}
            >
              {analyzing ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Feather name="plus" size={24} color={colors.secondary} />
              )}
              <Text
                style={[
                  styles.imageAddLabel,
                  { color: colors.mutedForeground },
                ]}
              >
                {imageUris.length === 0 ? "Dodaj\nsliku" : "Još"}
              </Text>
            </Pressable>
          )}
        </ScrollView>

        {analyzing && (
          <View
            style={[
              styles.aiBanner,
              {
                backgroundColor: colors.muted,
                borderColor: colors.primary,
              },
            ]}
          >
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={[styles.aiText, { color: colors.primary }]}>
              AI prepoznaje predmet…
            </Text>
          </View>
        )}

        {/* Naziv */}
        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <Text
              style={[styles.sectionLabel, { color: colors.mutedForeground }]}
            >
              Naziv predmeta
            </Text>
            {titleAIBadge ? (
              <View style={[styles.aiBadgePill, { backgroundColor: colors.primary + "20", borderColor: colors.primary + "50" }]}>
                <Text style={[styles.aiBadgeText, { color: colors.primary }]}>✨ AI predložilo</Text>
              </View>
            ) : !title.trim() ? (
              <Text style={[styles.requiredTag, { color: colors.destructive }]}>obvezno</Text>
            ) : null}
          </View>
          <View style={styles.titleWrapper}>
            <TextInput
              value={title}
              onChangeText={(v) => {
                setTitle(v);
                if (titleFromAI.current) {
                  titleFromAI.current = false;
                  setTitleAIBadge(false);
                  console.log("[AI] Korisnik ispravio AI naslov");
                }
              }}
              placeholder="npr. Sony slušalice, Bicikl Trek…"
              placeholderTextColor={colors.mutedForeground}
              style={[inputStyle, styles.titleInput]}
              maxLength={80}
              autoCorrect
              spellCheck
            />
            {titleSuggesting && (
              <View style={styles.titleAiDot}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            )}
          </View>
        </View>

        {/* Opis */}
        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <Text
              style={[styles.sectionLabel, { color: colors.mutedForeground }]}
            >
              Opis
            </Text>
            {descriptionAIBadge ? (
              <View style={[styles.aiBadgePill, { backgroundColor: colors.primary + "20", borderColor: colors.primary + "50" }]}>
                <Text style={[styles.aiBadgeText, { color: colors.primary }]}>✨ AI predložilo</Text>
              </View>
            ) : !description.trim() ? (
              <Text style={[styles.requiredTag, { color: colors.destructive }]}>obvezno</Text>
            ) : null}
          </View>
          <TextInput
            value={description}
            onChangeText={(v) => {
              setDescription(v);
              if (descriptionFromAI.current) {
                descriptionFromAI.current = false;
                setDescriptionAIBadge(false);
                console.log("[AI] Korisnik ispravio AI opis");
              }
            }}
            placeholder="Opiši predmet — stanje, veličina, marka, godište…"
            placeholderTextColor={colors.mutedForeground}
            style={[inputStyle, styles.descInput]}
            multiline
            maxLength={500}
            textAlignVertical="top"
            autoCorrect
            spellCheck
          />
        </View>

        {/* Stanje */}
        <ChipGroup<Condition>
          label="Stanje predmeta"
          required
          value={condition}
          onSelect={setCondition}
          colors={colors}
          options={CONDITIONS.map((c) => ({ key: c, label: c }))}
        />

        {/* Veličina paketa */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
            Veličina paketa (za dostavu)
          </Text>
          <View style={{ gap: 8, marginTop: 4 }}>
            {([
              { key: "small" as PackageSize, emoji: "📦", label: "Mali paket", sub: "Paketomat — do 20 kg" },
              { key: "medium" as PackageSize, emoji: "🚐", label: "Srednji paket", sub: "GLS kućna dostava — do 31 kg" },
              { key: "large" as PackageSize, emoji: "🚛", label: "Veliki / nestandardan", sub: "Osobni dogovor — bez kurirske" },
            ] as const).map((opt) => {
              const selected = packageSize === opt.key;
              return (
                <View key={opt.key}>
                  <Pressable
                    onPress={() => {
                      if (selected) { setPackageSize(null); setPackageBoxSize(null); setPackageWeight(""); }
                      else { setPackageSize(opt.key); setPackageBoxSize(null); setPackageWeight(""); }
                    }}
                    style={[
                      styles.pkgOption,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? "rgba(245,193,0,0.08)" : colors.muted,
                        marginBottom: 0,
                      },
                    ]}
                  >
                    <Text style={styles.pkgEmoji}>{opt.emoji}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.pkgLabel, { color: selected ? colors.primary : colors.foreground }]}>
                        {opt.label}
                      </Text>
                      <Text style={[styles.pkgSub, { color: colors.mutedForeground }]}>{opt.sub}</Text>
                    </View>
                    {selected && (
                      <View style={[styles.pkgCheck, { backgroundColor: colors.primary }]}>
                        <Text style={{ color: "#08152E", fontSize: 10, fontFamily: "Inter_700Bold" }}>✓</Text>
                      </View>
                    )}
                  </Pressable>

                  {/* ── Sub-forma za mali paket (paketomat) ── */}
                  {selected && opt.key === "small" && (
                    <View style={[styles.pkgSubForm, { borderColor: colors.border }]}>
                      <Text style={[styles.pkgSubLabel, { color: colors.mutedForeground }]}>
                        Odaberi veličinu kutije:
                      </Text>
                      {([
                        { key: "S" as PackageBoxSize, dim: "38 × 64 × 6 cm", kg: "do 5 kg" },
                        { key: "M" as PackageBoxSize, dim: "38 × 64 × 19 cm", kg: "do 10 kg" },
                        { key: "L" as PackageBoxSize, dim: "38 × 64 × 38 cm", kg: "do 20 kg" },
                      ]).map((box) => {
                        const boxSel = packageBoxSize === box.key;
                        return (
                          <Pressable
                            key={box.key}
                            onPress={() => setPackageBoxSize(boxSel ? null : box.key)}
                            style={[
                              styles.pkgBoxOption,
                              {
                                borderColor: boxSel ? colors.primary : colors.border,
                                backgroundColor: boxSel ? "rgba(245,193,0,0.08)" : "transparent",
                              },
                            ]}
                          >
                            <View style={[styles.pkgBoxBadge, { backgroundColor: boxSel ? colors.primary : colors.border }]}>
                              <Text style={[styles.pkgBoxBadgeText, { color: boxSel ? "#08152E" : colors.foreground }]}>
                                {box.key}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.pkgBoxDim, { color: boxSel ? colors.primary : colors.foreground }]}>
                                {box.dim}
                              </Text>
                              <Text style={[styles.pkgBoxKg, { color: colors.mutedForeground }]}>
                                {box.kg}
                              </Text>
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}

                  {/* ── Sub-forma za srednji paket (GLS) ── */}
                  {selected && opt.key === "medium" && (
                    <View style={[styles.pkgSubForm, { borderColor: colors.border }]}>
                      <Text style={[styles.pkgSubLabel, { color: colors.mutedForeground }]}>
                        Težina paketa (kg):
                      </Text>
                      <View style={styles.pkgWeightRow}>
                        <TextInput
                          style={[styles.pkgWeightInput, {
                            color: colors.foreground,
                            borderColor: colors.border,
                            backgroundColor: colors.muted,
                          }]}
                          value={packageWeight}
                          onChangeText={(t) => setPackageWeight(t.replace(/[^0-9.,]/g, ""))}
                          keyboardType="decimal-pad"
                          placeholder="npr. 4.5"
                          placeholderTextColor={colors.mutedForeground}
                          maxLength={6}
                        />
                        <Text style={[styles.pkgWeightUnit, { color: colors.mutedForeground }]}>kg</Text>
                      </View>
                      <Text style={[styles.pkgSubHint, { color: colors.mutedForeground }]}>
                        💡 GLS naplaćuje po kg. Ako je kutija velika ali lagana, mogu primijeniti volumetrijsku težinu (D×Š×V ÷ 5000).
                      </Text>
                    </View>
                  )}

                  {/* ── Info za veliki predmet ── */}
                  {selected && opt.key === "large" && (
                    <View style={[styles.pkgSubForm, { borderColor: colors.border }]}>
                      <Text style={[styles.pkgSubHint, { color: colors.mutedForeground }]}>
                        🤝 Dogovorite se direktno u chatu o terminu i načinu preuzimanja. Kurirska dostava nije opcija za ovako velike predmete.
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>

        {/* Vrijednost */}
        <View style={styles.section}>
          <Text
            style={[styles.sectionLabel, { color: colors.mutedForeground }]}
          >
            Procijenjena vrijednost (opcionalno)
          </Text>
          <View style={styles.priceRow}>
            <View
              style={[
                styles.euroPrefix,
                {
                  backgroundColor: colors.muted,
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.euroPrefixText, { color: colors.primary }]}>
                €
              </Text>
            </View>
            <TextInput
              value={priceText}
              onChangeText={(t) => setPriceText(t.replace(/[^0-9.,]/g, ""))}
              placeholder="0"
              placeholderTextColor={colors.mutedForeground}
              style={[inputStyle, { flex: 1 }]}
              keyboardType="decimal-pad"
              maxLength={10}
            />
          </View>
        </View>
      </SectionCard>

      {/* ── Kartica 2: Što tražiš ── */}
      <SectionCard icon="search" title="Što tražiš" colors={colors}>
        {/* Što tražiš u zamjenu */}
        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <Text
              style={[styles.sectionLabel, { color: colors.mutedForeground }]}
            >
              Što tražiš u zamjenu
            </Text>
            {!wantedFor.trim() && (
              <Text
                style={[styles.requiredTag, { color: colors.destructive }]}
              >
                obvezno
              </Text>
            )}
          </View>
          <TextInput
            value={wantedFor}
            onChangeText={setWantedFor}
            placeholder="npr. laptop, bicikl, kuća na moru u kolovozu…"
            placeholderTextColor={colors.mutedForeground}
            style={inputStyle}
            maxLength={200}
            autoCorrect
            spellCheck
          />
        </View>

        <ChipGroup<Flexibility>
          label="Koliko si fleksibilan?"
          required
          value={flexibility}
          onSelect={setFlexibility}
          colors={colors}
          options={[
            { key: "tocno", label: "Znam točno što hoću" },
            { key: "otvoren", label: "Otvoren sam ponudama" },
          ]}
        />

        <ChipGroup<Topup>
          label="Nadoplata"
          required
          value={topup}
          onSelect={setTopup}
          colors={colors}
          options={[
            { key: "primam", label: "Primam nadoplatu" },
            { key: "dajem", label: "Dajem nadoplatu" },
            { key: "oboje", label: "Oboje" },
            { key: "ne", label: "Bez nadoplate" },
          ]}
        />

        <ChipGroup<"da" | "ne">
          label="Prihvaćaš novac ako nema trampe?"
          required
          value={
            cashFallback === null ? null : cashFallback ? "da" : "ne"
          }
          onSelect={(v) => setCashFallback(v === "da")}
          colors={colors}
          options={[
            { key: "da", label: "Da, prihvaćam" },
            { key: "ne", label: "Ne, samo trampa" },
          ]}
        />
      </SectionCard>

      {/* ── Kartica 3: Detalji ── */}
      <SectionCard icon="map-pin" title="Detalji" colors={colors}>
        {/* Lokacija */}
        <View style={styles.section}>
          <View style={styles.sectionLabelRow}>
            <Text
              style={[styles.sectionLabel, { color: colors.mutedForeground }]}
            >
              Lokacija predmeta
            </Text>
            {!location.trim() && (
              <Text
                style={[styles.requiredTag, { color: colors.destructive }]}
              >
                obvezno
              </Text>
            )}
          </View>
          <View style={styles.locationWrap}>
            <View
              style={[
                styles.locationInputRow,
                {
                  backgroundColor: colors.muted,
                  borderColor: location
                    ? colors.primary
                    : locationFocused
                      ? colors.secondary
                      : colors.border,
                },
              ]}
            >
              <Feather
                name="map-pin"
                size={16}
                color={location ? colors.primary : colors.mutedForeground}
              />
              <TextInput
                value={location}
                onChangeText={(v) => {
                  setLocation(v);
                  if (locationDebounceRef.current)
                    clearTimeout(locationDebounceRef.current);
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
                onBlur={() =>
                  setTimeout(() => {
                    setLocationFocused(false);
                  }, 180)
                }
                placeholder="Grad ili adresa predmeta…"
                placeholderTextColor={colors.mutedForeground}
                style={[styles.locationInput, { color: colors.foreground }]}
                autoCorrect={false}
                autoCapitalize="none"
              />
              {locationLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : location ? (
                <Pressable
                  hitSlop={8}
                  onPress={() => {
                    setLocation("");
                    setLocationSuggestions([]);
                    setLocationCoords(null);
                  }}
                >
                  <Feather name="x" size={15} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>
            {locationFocused && locationSuggestions.length > 0 && (
              <View
                style={[
                  styles.locationDropdown,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                ]}
              >
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
                      i > 0 && {
                        borderTopWidth: 1,
                        borderTopColor: colors.border,
                      },
                      { backgroundColor: pressed ? colors.muted : "transparent" },
                    ]}
                  >
                    <Feather
                      name="map-pin"
                      size={12}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.locationSuggText,
                        { color: colors.foreground },
                      ]}
                      numberOfLines={1}
                    >
                      {s.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
            {locationCoords && !locationFocused && (
              <Pressable
                onPress={() =>
                  Linking.openURL(
                    `https://www.google.com/maps?q=${locationCoords.lat},${locationCoords.lon}`
                  )
                }
                style={({ pressed }) => [
                  styles.mapPreview,
                  { opacity: pressed ? 0.85 : 1, borderColor: colors.border },
                ]}
              >
                <Image
                  source={{
                    uri: `https://staticmap.openstreetmap.de/staticmap.php?center=${locationCoords.lat},${locationCoords.lon}&zoom=13&size=600x180&markers=${locationCoords.lat},${locationCoords.lon},red-marker`,
                  }}
                  style={styles.mapImage}
                  contentFit="cover"
                />
                <View
                  style={[
                    styles.mapOverlay,
                    { backgroundColor: colors.card + "CC" },
                  ]}
                >
                  <Feather name="map" size={13} color={colors.secondary} />
                  <Text
                    style={[
                      styles.mapOverlayText,
                      { color: colors.secondary },
                    ]}
                  >
                    Otvori u Google Maps
                  </Text>
                </View>
              </Pressable>
            )}
          </View>
        </View>

        <ChipGroup<Deadline>
          label="Rok trampe"
          required
          value={deadline}
          onSelect={setDeadline}
          colors={colors}
          options={[
            { key: "hitno", label: "Hitno (ovaj tjedan)" },
            { key: "ovaj-mjesec", label: "Ovaj mjesec" },
            { key: "bez-roka", label: "Bez roka" },
          ]}
        />

        {/* Telefon (opcionalno) */}
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowPhone(!showPhone);
          }}
          style={styles.checkboxRow}
        >
          <View
            style={[
              styles.checkbox,
              {
                borderColor: showPhone ? colors.secondary : colors.border,
                backgroundColor: showPhone ? colors.secondary : "transparent",
              },
            ]}
          >
            {showPhone && (
              <Feather
                name="check"
                size={12}
                color={colors.secondaryForeground}
              />
            )}
          </View>
          <Text style={[styles.checkboxLabel, { color: colors.foreground }]}>
            Prikaži broj telefona (opcionalno)
          </Text>
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
      </SectionCard>

      {/* ── Submit ── */}
      <View style={styles.submitArea}>
        <View style={styles.progressRow}>
          <View
            style={[styles.progressTrack, { backgroundColor: colors.muted }]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  backgroundColor: isValid ? "#4ADE80" : colors.primary,
                  width: `${(filledCount / TOTAL_REQUIRED) * 100}%`,
                },
              ]}
            />
          </View>
          <Text
            style={[styles.progressLabel, { color: colors.mutedForeground }]}
          >
            {filledCount}/{TOTAL_REQUIRED}
          </Text>
        </View>

        <Pressable
          onPress={handleSubmit}
          disabled={!isValid || submitted}
          style={({ pressed }) => [
            styles.submitBtn,
            {
              backgroundColor: submitted
                ? "#2E7D4F"
                : isValid
                  ? colors.primary
                  : colors.muted,
              borderColor: submitted
                ? "#2E7D4F"
                : isValid
                  ? colors.primary
                  : colors.border,
              opacity: pressed ? 0.85 : 1,
              transform: [{ scale: pressed ? 0.97 : 1 }],
            },
          ]}
        >
          {moderating ? (
            <>
              <ActivityIndicator size="small" color={colors.primaryForeground} />
              <Text style={[styles.submitText, { color: colors.primaryForeground }]}>
                Provjera sadržaja...
              </Text>
            </>
          ) : (
            <>
              <Feather
                name={submitted ? "check" : "plus"}
                size={18}
                color={
                  isValid || submitted
                    ? colors.primaryForeground
                    : colors.mutedForeground
                }
              />
              <Text
                style={[
                  styles.submitText,
                  {
                    color:
                      isValid || submitted
                        ? colors.primaryForeground
                        : colors.mutedForeground,
                  },
                ]}
              >
                {submitted ? "Oglas objavljen!" : "Objavi oglas"}
              </Text>
            </>
          )}
        </Pressable>
      </View>
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

function WantedSuggestions({
  wantedFor,
  priceText,
  listings,
  colors,
}: WantedSuggestionsProps) {
  const [matches, setMatches] = React.useState<
    import("@/context/ListingsContext").Listing[]
  >([]);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const q = wantedFor.trim();
      if (q.length < 2) {
        setMatches([]);
        return;
      }
      const detectedCat = detectCategoryLocally(q);
      const myPrice = priceText
        ? parseFloat(priceText.replace(",", "."))
        : null;

      function normalize(s: string) {
        return s
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "");
      }
      function tokenize(text: string): string[] {
        return normalize(text)
          .split(/[\s,.!?;:()\-\/\\]+/)
          .filter((w) => w.length >= 3);
      }
      function wordsSimilar(a: string, b: string): boolean {
        if (a === b) return true;
        const short = a.length <= b.length ? a : b;
        const long = a.length <= b.length ? b : a;
        if (short.length / long.length < 0.75) return false;
        const prefixLen = short.length - 1;
        return prefixLen >= 2 && a.substring(0, prefixLen) === b.substring(0, prefixLen);
      }
      function textScore(queryTokens: string[], text: string): number {
        const listingTokens = tokenize(text);
        return queryTokens.reduce(
          (sum, qt) =>
            sum + (listingTokens.some((lt) => wordsSimilar(qt, lt)) ? 1 : 0),
          0
        );
      }

      const queryTokens = tokenize(q);
      const candidates = listings.filter(
        (l) => l.status === "active" && !l.isMine
      );
      const scored = candidates
        .map((l) => {
          const catMatch = detectedCat
            ? l.category === detectedCat
              ? 2
              : 0
            : 0;
          const combinedText =
            l.title + " " + l.description + " " + l.wantedFor;
          const wordScore = textScore(queryTokens, combinedText);
          return { l, score: catMatch + wordScore * 3, wordScore };
        })
        .filter(({ wordScore }) => wordScore > 0);

      scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (myPrice == null) return 0;
        const aDiff =
          a.l.price != null ? Math.abs(a.l.price - myPrice) : Infinity;
        const bDiff =
          b.l.price != null ? Math.abs(b.l.price - myPrice) : Infinity;
        return aDiff - bDiff;
      });

      setMatches(scored.slice(0, 8).map(({ l }) => l));
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
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
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <View style={[wStyles.catBadge, { backgroundColor: colors.muted }]}>
              <Text
                style={[wStyles.catText, { color: colors.mutedForeground }]}
              >
                {item.category}
              </Text>
            </View>
            <Text
              style={[wStyles.cardTitle, { color: colors.foreground }]}
              numberOfLines={2}
            >
              {item.title}
            </Text>
            {item.price != null && (
              <Text style={[wStyles.cardPrice, { color: colors.primary }]}>
                {item.price} €
              </Text>
            )}
            <Text
              style={[wStyles.cardSub, { color: colors.mutedForeground }]}
              numberOfLines={1}
            >
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
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  scroll: { gap: 8, paddingRight: 4 },
  card: {
    width: 130,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 5,
  },
  catBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  catText: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.2,
    textTransform: "uppercase",
  },
  cardTitle: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 16 },
  cardPrice: { fontSize: 13, fontFamily: "Inter_700Bold" },
  cardSub: { fontSize: 10, fontFamily: "Inter_400Regular" },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 14 },
  aiBadgePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  aiBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },

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
  headingSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },

  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
  },

  section: { gap: 8 },

  // Package size selector
  pkgOption: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 12,
  },
  pkgEmoji: { fontSize: 22 },
  pkgLabel: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  pkgSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  pkgCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  pkgSubForm: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 8,
  },
  pkgSubLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  pkgBoxOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  pkgBoxBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  pkgBoxBadgeText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  pkgBoxDim: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  pkgBoxKg: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  pkgWeightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pkgWeightInput: {
    width: 90,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  pkgWeightUnit: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  pkgSubHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    lineHeight: 17,
    marginTop: 4,
  },

  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  requiredTag: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
  },

  imageSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  imageCountBadge: { fontSize: 12, fontFamily: "Inter_500Medium" },
  imageStrip: { flexDirection: "row", gap: 8, paddingVertical: 2 },
  imageThumb: {
    width: 88,
    height: 88,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
    flexShrink: 0,
  },
  mainBadge: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 3,
    alignItems: "center",
  },
  mainBadgeText: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  removeBtn: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 10,
    padding: 3,
  },
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
  imageAddLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
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

  titleWrapper: { position: "relative" },
  titleAiDot: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  titleInput: { flex: 0 },
  descInput: {
    minHeight: 72,
    paddingTop: 12,
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

  priceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  euroPrefix: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  euroPrefixText: { fontSize: 16, fontFamily: "Inter_700Bold" },

  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },

  locationWrap: { position: "relative" },
  locationInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  locationInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  locationDropdown: {
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 4,
    overflow: "hidden",
  },
  locationSuggItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  locationSuggText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    flex: 1,
  },
  mapPreview: {
    marginTop: 8,
    borderRadius: 10,
    overflow: "hidden",
    borderWidth: 1,
    height: 140,
  },
  mapImage: { width: "100%", height: "100%" },
  mapOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  mapOverlayText: { fontSize: 11, fontFamily: "Inter_500Medium" },

  checkboxRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxLabel: { fontSize: 14, fontFamily: "Inter_400Regular" },

  submitArea: { gap: 10 },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  progressTrack: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  progressLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    minWidth: 28,
    textAlign: "right",
  },
  submitBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1.5,
  },
  submitText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
});
