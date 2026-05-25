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

// ─── Ad banner placeholder ────────────────────────────────────────────────────
function AdBannerSlot({ size = "medium" }: { size?: "small" | "medium" | "bottom" }) {
  const colors = useColors();
  const height = size === "bottom" ? 52 : size === "small" ? 44 : 72;
  return (
    <View
      style={[
        adStyles.wrap,
        {
          height,
          backgroundColor: `${colors.muted}CC`,
          borderColor: `${colors.border}88`,
        },
      ]}
    >
      <Feather name="bar-chart-2" size={13} color={colors.mutedForeground} />
      <Text style={[adStyles.label, { color: colors.mutedForeground }]}>Google Oglas</Text>
    </View>
  );
}

const adStyles = StyleSheet.create({
  wrap: {
    width: "100%",
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginVertical: 4,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.3,
  },
});

// ─── Row type used by FlatList ────────────────────────────────────────────────
type ItemRow = { type: "row"; id: string; items: Listing[] };
type AdRow   = { type: "ad";  id: string };
type Row     = ItemRow | AdRow;

/**
 * Injects full-width ad rows into listing rows.
 * Pattern: 3 rows (9 listings), AD, 2 rows (6 listings), AD, repeat.
 */
function buildRows(listings: Listing[]): Row[] {
  const COLS = 3;
  // Split listings into rows of 3
  const itemRows: ItemRow[] = [];
  for (let i = 0; i < listings.length; i += COLS) {
    itemRows.push({
      type: "row",
      id: `row_${i}`,
      items: listings.slice(i, i + COLS),
    });
  }

  // Inject ads: first ad after 3 rows, then every 2 rows, then every 3 rows (alternates)
  const result: Row[] = [];
  const adPattern = [3, 2]; // rows between ads: 3, 2, 3, 2, ...
  let patternIdx = 0;
  let rowIdx = 0;
  let adIdx = 0;

  while (rowIdx < itemRows.length) {
    const take = adPattern[patternIdx % adPattern.length];
    const chunk = itemRows.slice(rowIdx, rowIdx + take);
    result.push(...chunk);
    rowIdx += take;
    if (rowIdx < itemRows.length || chunk.length === take) {
      result.push({ type: "ad", id: `ad_${adIdx++}` });
    }
    patternIdx++;
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

  const rows = useMemo(() => buildRows(filtered), [filtered]);

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;
  // Guest: bottom inset for the fixed ad banner (52px banner + safe area)
  const guestBottomAd = !user ? 52 : 0;

  const renderRow = ({ item }: { item: Row }) => {
    if (item.type === "ad") {
      return (
        <View style={{ paddingHorizontal: 10 }}>
          <AdBannerSlot size="medium" />
        </View>
      );
    }
    return (
      <View style={styles.rowWrap}>
        {item.items.map((listing) => (
          <ListingCard key={listing.id} listing={listing} />
        ))}
        {/* Fill empty cells so the row always has 3 columns */}
        {item.items.length < 3 &&
          Array.from({ length: 3 - item.items.length }).map((_, i) => (
            <View key={`empty_${i}`} style={styles.emptyCell} />
          ))}
      </View>
    );
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
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
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
  rowWrap: {
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 2,
    marginBottom: 6,
  },
  emptyCell: {
    flex: 1,
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
