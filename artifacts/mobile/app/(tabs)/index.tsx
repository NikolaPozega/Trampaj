import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
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
 * Injects card-sized ad slots into the flat data array.
 * Pattern: after 8 real items → AD (position 9), after 6 more → AD (position 7 of next group), repeat.
 */
function injectAds(listings: Listing[]): FlatItem[] {
  const result: FlatItem[] = [];
  const pattern = [8, 6]; // real items before each ad, alternating
  let pIdx = 0;
  let i = 0;
  let adCount = 0;
  while (i < listings.length) {
    const take = pattern[pIdx % pattern.length];
    const chunk = listings.slice(i, i + take);
    result.push(...chunk);
    i += take;
    // Insert ad after full chunk, or after the last chunk if it was exactly `take`
    if (i < listings.length || chunk.length === take) {
      result.push({ type: "ad", id: `ad_${adCount++}` });
    }
    pIdx++;
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
  const [search, setSearch] = useState("");
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  React.useEffect(() => {
    searchBus.clearSearch = () => setSearch("");
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

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      const matchesCategory =
        selectedCategories.length === 0 || selectedCategories.includes(l.category);
      const q = normSearch(search);
      const matchesSearch =
        !q ||
        normSearch(l.title).includes(q) ||
        normSearch(l.description).includes(q) ||
        normSearch(l.wantedFor).includes(q);
      return matchesCategory && matchesSearch && l.status === "active";
    });
  }, [listings, selectedCategories, search]);

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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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

        {/* Search bar — thinner when logged in */}
        <View style={[
          styles.searchBar,
          {
            backgroundColor: colors.muted,
            borderColor: colors.border,
            paddingVertical: user ? 7 : 12,
          },
        ]}>
          <Feather name="search" size={16} color={colors.mutedForeground} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Pretraži oglase..."
            placeholderTextColor={colors.mutedForeground}
            style={[styles.searchInput, { color: colors.foreground }]}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Feather name="x" size={16} color={colors.mutedForeground} />
            </Pressable>
          )}
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
              search
                ? `Nema rezultata za "${search}"`
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
    </View>
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    paddingVertical: Platform.OS === "web" ? 0 : 0,
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
