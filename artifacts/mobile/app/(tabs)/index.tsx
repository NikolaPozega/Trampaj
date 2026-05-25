import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "@/components/EmptyState";
import { ListingCard } from "@/components/ListingCard";
import { CATEGORIES, useListings } from "@/context/ListingsContext";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { searchBus } from "@/utils/searchBus";
import { queryMatchesFields } from "@/utils/stemHr";
import type { Listing } from "@/context/ListingsContext";

// ─── Ad placeholder components ───────────────────────────────────────────────

/** Card-sized ad — fits in the 3-column grid as a regular cell */
function AdCardSlot() {
  const colors = useColors();
  return (
    <View style={[adStyles.card, { backgroundColor: `${colors.muted}CC`, borderColor: `${colors.border}88` }]}>
      <Feather name="bar-chart-2" size={14} color={colors.mutedForeground} />
      <Text style={[adStyles.cardLabel, { color: colors.mutedForeground }]}>Oglas</Text>
    </View>
  );
}

/** Full-width horizontal banner — for header/footer strips */
function AdBannerSlot({ size = "medium" }: { size?: "small" | "bottom" }) {
  const colors = useColors();
  const height = size === "bottom" ? 52 : 44;
  return (
    <View style={[adStyles.banner, { height, backgroundColor: `${colors.muted}CC`, borderColor: `${colors.border}88` }]}>
      <Feather name="bar-chart-2" size={13} color={colors.mutedForeground} />
      <Text style={[adStyles.bannerLabel, { color: colors.mutedForeground }]}>Google Oglas</Text>
    </View>
  );
}

const adStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    aspectRatio: 0.72, // same proportions as ListingCard
  },
  cardLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.3,
  },
  banner: {
    width: "100%",
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginVertical: 2,
  },
  bannerLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.3,
  },
});

// ─── Ad injection into flat listing array ────────────────────────────────────
type AdSlot = { type: "ad"; id: string };
type FlatItem = Listing | AdSlot;

/**
 * Injects card-sized ad slots at exact grid positions.
 * Ads alternate between col 3 and col 1, every 3 rows:
 *   row3-col3, row6-col1, row9-col3, row12-col1, ...
 *
 * Pre-compute the flat indices in the final mixed array, then fill
 * non-ad slots with listings in order.
 */
function injectAds(listings: Listing[]): FlatItem[] {
  if (listings.length === 0) return [];

  // Build set of flat indices (in the final array) where an ad sits.
  // Row R (1-based), Col C (1-based) → flat index = (R-1)*3 + (C-1)
  const adIndices = new Set<number>();
  for (let n = 0; n < 200; n++) {
    const row = 3 + n * 3;          // 3, 6, 9, 12, 15 …
    const col = n % 2 === 0 ? 3 : 1; // alternates col3, col1
    adIndices.add((row - 1) * 3 + (col - 1));
  }

  const result: FlatItem[] = [];
  let listingIdx = 0;
  let flatIdx = 0;

  while (listingIdx < listings.length) {
    if (adIndices.has(flatIdx)) {
      result.push({ type: "ad", id: `ad_${flatIdx}` });
    } else {
      result.push(listings[listingIdx++]);
    }
    flatIdx++;
  }

  return result;
}

const FILTER_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  Sve: "grid",
  Elektronika: "cpu",
  Odjeća: "shopping-bag",
  Knjige: "book",
  Sport: "activity",
  Nakit: "star",
  Namještaj: "home",
  Igračke: "gift",
  Ostalo: "package",
};

export default function BrowseScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { listings, isLoaded } = useListings();
  const { user, logout } = useAuth();
  const [searchTrazim, setSearchTrazim] = useState("");
  const [searchNudim, setSearchNudim] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  React.useEffect(() => {
    searchBus.clearSearch = () => { setSearchTrazim(""); setSearchNudim(""); };
    return () => { searchBus.clearSearch = null; };
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await new Promise((r) => setTimeout(r, 700));
    setRefreshing(false);
  }

  function toggleCategory(cat: string) {
    if (cat === "Sve") {
      setSelectedCategories([]);
      return;
    }
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function normSearch(s: string) {
    return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  // Provjeri sadrži li polje tekstualne tokene iz upita (s HR stemmerjem)
  function matchesQuery(q: string, fields: string[]): boolean {
    return queryMatchesFields(q, fields);
  }

  const filtered = useMemo(() => {
    const hasTrazim = searchTrazim.trim().length > 0;
    const hasNudim  = searchNudim.trim().length > 0;

    return listings.filter((l) => {
      if (l.status !== "active") return false;
      if (selectedCategories.length > 0 && !selectedCategories.includes(l.category)) return false;

      if (!hasTrazim && !hasNudim) return true;

      const nudimText = [
        normSearch(l.title),
        normSearch(l.description),
        ...(l.nudimTags ?? []).map(normSearch),
      ];
      const trazimText = [
        normSearch(l.wantedFor),
        ...(l.trazimTags ?? []).map(normSearch),
      ];

      // "Tražim X" → tražim oglas gdje netko nudi X
      const trazimOk = !hasTrazim || matchesQuery(searchTrazim, nudimText);
      // "Nudim Y"  → tražim oglas gdje netko traži Y
      const nudimOk  = !hasNudim  || matchesQuery(searchNudim,  trazimText);

      // Ako su oba popunjena: oglas mora zadovoljiti oba uvjeta
      // Ako je samo jedan: dovoljno je jedan
      return hasTrazim && hasNudim ? trazimOk && nudimOk : trazimOk && nudimOk;
    });
  }, [listings, selectedCategories, searchTrazim, searchNudim]);

  const flatData = useMemo(() => injectAds(filtered), [filtered]);

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;
  // Guest: bottom inset for the fixed ad banner (52px banner + safe area)
  const guestBottomAd = !user ? 52 : 0;

  const renderItem = ({ item }: { item: FlatItem }) => {
    if ("type" in item && item.type === "ad") {
      return <AdCardSlot />;
    }
    return <ListingCard listing={item as Listing} />;
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      {/* ── Sticky header ─────────────────────────────────────────────────── */}
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.background }]}>
        <View style={styles.logoRow}>
          <Pressable
            style={styles.logoBrand}
            onPress={() => { setSearch(""); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          >
            <View style={[styles.logoIcon, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              <Feather name="refresh-cw" size={22} color={colors.primary} />
            </View>
            <Text style={[styles.logoText, { color: colors.foreground }]}>
              Trampaj<Text style={{ color: colors.secondary }}>.hr</Text>
            </Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          {user ? (
            <View style={styles.authLinks}>
              {user.avatarBase64 ? (
                <Image
                  source={{ uri: user.avatarBase64 }}
                  style={[styles.userAvatar, { borderColor: colors.primary }]}
                  contentFit="cover"
                />
              ) : (
                <View style={[styles.userAvatar, { borderColor: colors.primary, backgroundColor: `${colors.primary}22` }]}>
                  <Text style={[styles.userAvatarText, { color: colors.primary }]}>
                    {user.username.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={[styles.authLinkText, { color: colors.foreground, fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
                {user.username}
              </Text>
              <Text style={[styles.authDot, { color: colors.border }]}>|</Text>
              <Pressable
                onPress={async () => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  await logout();
                }}
                style={({ pressed }) => [styles.authLink, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.authLinkText, { color: colors.destructive }]}>Odjava</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.authLinks}>
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/login"); }}
                style={({ pressed }) => [styles.authLink, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.authLinkText, { color: colors.mutedForeground }]}>Prijava</Text>
              </Pressable>
              <Text style={[styles.authDot, { color: colors.border }]}>|</Text>
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/onboarding"); }}
                style={({ pressed }) => [styles.authLink, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Text style={[styles.authLinkText, { color: colors.secondary }]}>Registracija</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Search — dva polja: Tražim i Nudim */}
        <View style={styles.searchGroup}>
          <View style={[styles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="search" size={14} color={colors.secondary} />
            <Text style={[styles.searchLabel, { color: colors.secondary }]}>Tražim:</Text>
            <TextInput
              value={searchTrazim}
              onChangeText={setSearchTrazim}
              placeholder="bicikl, iPhone, jakna…"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground }]}
              returnKeyType="search"
            />
            {searchTrazim.length > 0 && (
              <Pressable onPress={() => setSearchTrazim("")}>
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
          <View style={[styles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="package" size={14} color={colors.primary} />
            <Text style={[styles.searchLabel, { color: colors.primary }]}>Nudim:</Text>
            <TextInput
              value={searchNudim}
              onChangeText={setSearchNudim}
              placeholder="peć, laptop, sofa…"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.searchInput, { color: colors.foreground }]}
              returnKeyType="search"
            />
            {searchNudim.length > 0 && (
              <Pressable onPress={() => setSearchNudim("")}>
                <Feather name="x" size={14} color={colors.mutedForeground} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Fixed ad banner in header — only when logged in */}
        {user && (
          <View style={{ marginHorizontal: 0 }}>
            <AdBannerSlot size="small" />
          </View>
        )}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          {CATEGORIES.map((cat) => {
            const isAll = cat === "Sve";
            const selected = isAll ? selectedCategories.length === 0 : selectedCategories.includes(cat);
            const icon = FILTER_ICONS[cat] ?? "package";
            return (
              <Pressable
                key={cat}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggleCategory(cat); }}
                style={({ pressed }) => [
                  styles.categoryChip,
                  {
                    backgroundColor: selected ? colors.primary : colors.muted,
                    borderColor: selected ? colors.primary : colors.border,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Feather
                  name={icon}
                  size={13}
                  color={selected ? colors.primaryForeground : colors.mutedForeground}
                />
                <Text
                  style={[
                    styles.categoryText,
                    { color: selected ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      {!isLoaded ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Učitavanje...</Text>
        </View>
      ) : filtered.length === 0 ? (
        <View style={{ flex: 1 }}>
          <EmptyState
            icon="search"
            title="Nema oglasa"
            subtitle={
              searchTrazim || searchNudim
                ? `Nema rezultata${searchTrazim ? ` — tražim: "${searchTrazim}"` : ""}${searchNudim ? ` — nudim: "${searchNudim}"` : ""}`
                : "U ovoj kategoriji nema aktivnih oglasa"
            }
          />
        </View>
      ) : (
        <FlatList
          data={flatData}
          keyExtractor={(item) => ("type" in item ? item.id : item.id)}
          renderItem={renderItem}
          numColumns={3}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={[
            styles.list,
            {
              paddingBottom:
                insets.bottom +
                guestBottomAd +
                (Platform.OS === "web" ? 60 : 100),
            },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      )}

      {/* ── Guest fixed bottom ad ──────────────────────────────────────────── */}
      {!user && (
        <View
          style={[
            styles.guestBottomAd,
            {
              backgroundColor: colors.background,
              borderTopColor: colors.border,
              paddingBottom: insets.bottom + 4,
            },
          ]}
        >
          <AdBannerSlot size="bottom" />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 10,
    zIndex: 1,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  logoBrand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  authLinks: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
  },
  authLink: { paddingVertical: 4, paddingHorizontal: 2 },
  authLinkText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  authDot: { fontSize: 11 },
  userAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatarText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.5,
  },
  searchGroup: {
    gap: 6,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    minWidth: 48,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingVertical: 0,
  },
  categories: {
    gap: 8,
    paddingRight: 8,
    paddingBottom: 4,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  list: {
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  columnWrapper: {
    gap: 6,
    paddingHorizontal: 2,
    marginBottom: 6,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  guestBottomAd: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 6,
    borderTopWidth: 1,
  },
});
