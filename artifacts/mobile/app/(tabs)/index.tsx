import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useMemo, useState, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { INTRO_DONE_KEY } from "@/utils/introKey";
import {
  FlatList,
  KeyboardAvoidingView,
  Linking,
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
import { useListings } from "@/context/ListingsContext";
import { useAuth } from "@/context/AuthContext";
import { useChat } from "@/context/ChatContext";
import { useColors } from "@/hooks/useColors";
import { searchBus } from "@/utils/searchBus";
import { queryMatchesFields } from "@/utils/stemHr";
import type { Listing } from "@/context/ListingsContext";

// ─── Ad placeholder components ───────────────────────────────────────────────

const AD_POOL = [
  { id: "a1", sponsor: "Mall.hr", tagline: "Sve na jednom mjestu", url: "https://www.mall.hr", icon: "shopping-cart" as const, color: "#E53935" },
  { id: "a2", sponsor: "njuškalo.hr", tagline: "Oglasi koje tražiš", url: "https://www.njuskalo.hr", icon: "search" as const, color: "#1565C0" },
  { id: "a3", sponsor: "Konzum Online", tagline: "Dostava do vrata", url: "https://www.konzum.hr", icon: "package" as const, color: "#2E7D32" },
  { id: "a4", sponsor: "Booking.com", tagline: "Putuj povoljnije", url: "https://www.booking.com", icon: "map-pin" as const, color: "#003580" },
  { id: "a5", sponsor: "Rimac Store", tagline: "Električna budućnost", url: "https://www.rimac.com", icon: "zap" as const, color: "#C62828" },
  { id: "a6", sponsor: "Superknjižara", tagline: "Knjige na popustu", url: "https://www.superknjizara.hr", icon: "book" as const, color: "#6A1B9A" },
];

function pickAd(seed: string) {
  const idx = Math.abs(seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % AD_POOL.length;
  return AD_POOL[idx]!;
}

/** Card-sized ad — fits in the 3-column grid as a regular cell */
function AdCardSlot({ seed }: { seed: string }) {
  const colors = useColors();
  const ad = pickAd(seed);
  return (
    <Pressable
      onPress={() => { Linking.openURL(ad.url).catch(() => {}); }}
      style={({ pressed }) => [adStyles.card, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={[adStyles.sponsoredBadge, { backgroundColor: colors.muted }]}>
        <Text style={[adStyles.sponsoredText, { color: colors.mutedForeground }]}>oglas</Text>
      </View>
      <View style={[adStyles.cardIconCircle, { backgroundColor: colors.muted }]}>
        <Feather name={ad.icon} size={18} color={ad.color} />
      </View>
      <Text style={[adStyles.cardSponsor, { color: colors.foreground }]} numberOfLines={1}>{ad.sponsor}</Text>
      <Text style={[adStyles.cardTagline, { color: colors.mutedForeground }]} numberOfLines={2}>{ad.tagline}</Text>
    </Pressable>
  );
}

/** Full-width horizontal banner — for header/footer strips */
function AdBannerSlot({ size = "small", seed = "banner" }: { size?: "small" | "bottom"; seed?: string }) {
  const colors = useColors();
  const height = size === "bottom" ? 52 : 44;
  const ad = pickAd(seed);
  return (
    <Pressable
      onPress={() => { Linking.openURL(ad.url).catch(() => {}); }}
      style={({ pressed }) => [adStyles.banner, { height, backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
    >
      <View style={[adStyles.cardIconCircle, { backgroundColor: colors.muted, width: 28, height: 28 }]}>
        <Feather name={ad.icon} size={13} color={ad.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[adStyles.bannerSponsor, { color: colors.foreground }]} numberOfLines={1}>{ad.sponsor}</Text>
        <Text style={[adStyles.bannerLabel, { color: colors.mutedForeground }]} numberOfLines={1}>{ad.tagline}</Text>
      </View>
      <Text style={[adStyles.bannerCta, { color: ad.color }]}>Posjeti →</Text>
    </Pressable>
  );
}

const adStyles = StyleSheet.create({
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    aspectRatio: 0.72,
    padding: 8,
    position: "relative" as const,
  },
  sponsoredBadge: {
    position: "absolute" as const,
    top: 6,
    right: 6,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  sponsoredText: {
    fontSize: 8,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.5,
    textTransform: "uppercase" as const,
  },
  cardIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  cardSponsor: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    textAlign: "center" as const,
    letterSpacing: -0.2,
  },
  cardTagline: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    textAlign: "center" as const,
    lineHeight: 12,
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
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 10,
    marginVertical: 2,
    paddingHorizontal: 12,
  },
  bannerSponsor: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.2,
  },
  bannerLabel: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.1,
  },
  bannerCta: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
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


export default function BrowseScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { listings, isLoaded, blockedUserNames, refreshListings } = useListings();
  const { user, logout } = useAuth();
  const { unreadCount } = useChat();
  const [searchTrazim, setSearchTrazim] = useState("");
  const [searchNudim, setSearchNudim] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(INTRO_DONE_KEY).then((val) => {
      if (!val) router.replace("/intro");
    });
  }, []);

  React.useEffect(() => {
    searchBus.clearSearch = () => { setSearchTrazim(""); setSearchNudim(""); };
    return () => { searchBus.clearSearch = null; };
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refreshListings();
    } finally {
      setRefreshing(false);
    }
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
      if (blockedUserNames.includes(l.userName)) return false;

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
  }, [listings, blockedUserNames, searchTrazim, searchNudim]);

  const flatData = useMemo(() => injectAds(filtered), [filtered]);

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;
  // Guest: bottom inset for the fixed ad banner (52px banner + safe area)
  const guestBottomAd = !user ? 52 : 0;

  const renderItem = ({ item }: { item: FlatItem }) => {
    if ("type" in item && item.type === "ad") {
      return <AdCardSlot seed={item.id} />;
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
            onPress={() => { searchBus.clearSearch?.(); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); void onRefresh(); }}
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
              {/* Envelope / inbox circle */}
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/inbox"); }}
                style={({ pressed }) => [
                  styles.inboxCircle,
                  { backgroundColor: colors.muted, borderColor: unreadCount > 0 ? `${colors.secondary}60` : colors.border, opacity: pressed ? 0.75 : 1 },
                ]}
              >
                <Feather name="mail" size={14} color={unreadCount > 0 ? colors.secondary : colors.mutedForeground} />
                {unreadCount > 0 && (
                  <View style={[styles.inboxCircleBadge, { backgroundColor: colors.secondary }]}>
                    <Text style={[styles.inboxCircleBadgeText, { color: colors.background }]}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Text>
                  </View>
                )}
              </Pressable>
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
            <AdBannerSlot size="small" seed="header-logged-in" />
          </View>
        )}

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
          <AdBannerSlot size="bottom" seed="guest-bottom" />
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
  inboxCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  inboxCircleBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 14,
    height: 14,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 2,
  },
  inboxCircleBadgeText: { fontSize: 8, fontFamily: "Inter_700Bold" },
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
