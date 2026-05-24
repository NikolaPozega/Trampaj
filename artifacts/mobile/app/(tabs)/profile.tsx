import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { EmptyState } from "@/components/EmptyState";
import { ListingCard } from "@/components/ListingCard";
import { CATEGORIES, type Listing, useListings } from "@/context/ListingsContext";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { findTradeMatches, type TradeMatch } from "@/services/tradeMatches";

interface EditState {
  id: string;
  title: string;
  description: string;
  wantedFor: string;
  priceText: string;
  category: string;
  location: string;
}

const LOCATION_OPTIONS = [
  "Zagreb", "Split", "Rijeka", "Osijek",
  "Sarajevo", "Beograd", "Ljubljana", "Ostalo",
];

const MATCH_LABEL: Record<TradeMatch["matchType"], string> = {
  both: "Obostrana zamjena ✦",
  i_want: "Ti tražiš ovo",
  they_want: "Oni traže što ti imaš",
};

// ─── Swipeable Match Card ──────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 65;

function MatchCard({
  match,
  colors,
  onDismiss,
  onSave,
  onSwipeStart,
  onSwipeEnd,
}: {
  match: TradeMatch;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  onDismiss: () => void;
  onSave: () => void;
  onSwipeStart: () => void;
  onSwipeEnd: () => void;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  const dismissOverlayOpacity = translateY.interpolate({
    inputRange: [-SWIPE_THRESHOLD, -10, 0],
    outputRange: [1, 0.3, 0],
    extrapolate: "clamp",
  });
  const saveOverlayOpacity = translateY.interpolate({
    inputRange: [0, 10, SWIPE_THRESHOLD],
    outputRange: [0, 0.3, 1],
    extrapolate: "clamp",
  });

  const panResponder = useRef(
    PanResponder.create({
      // Capture immediately on touch — prevents parent FlatList from seeing it
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        onSwipeStart();
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      },
      onPanResponderMove: (_, g) => {
        translateY.setValue(g.dy);
      },
      onPanResponderRelease: (_, g) => {
        onSwipeEnd();
        if (g.dy < -SWIPE_THRESHOLD) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          Animated.parallel([
            Animated.timing(translateY, { toValue: -300, duration: 220, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
          ]).start(onDismiss);
        } else if (g.dy > SWIPE_THRESHOLD) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          Animated.parallel([
            Animated.timing(translateY, { toValue: 300, duration: 220, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
          ]).start(onSave);
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 120,
            friction: 8,
          }).start();
        }
      },
      onPanResponderTerminate: () => {
        onSwipeEnd();
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      },
    })
  ).current;

  const isBoth = match.matchType === "both";
  const badgeColor = isBoth ? colors.primary : colors.secondary;
  const badgeBg = isBoth ? `${colors.primary}22` : `${colors.secondary}22`;

  return (
    <Animated.View
      style={[
        mcStyles.card,
        {
          backgroundColor: colors.card,
          borderColor: isBoth ? colors.primary : colors.border,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      {/* Swipe area — captures ALL touches, page never scrolls */}
      <View {...panResponder.panHandlers} style={mcStyles.swipeArea}>
        {/* Dismiss overlay (swipe up) */}
        <Animated.View
          pointerEvents="none"
          style={[mcStyles.actionOverlay, mcStyles.dismissOverlay, { opacity: dismissOverlayOpacity }]}
        >
          <Feather name="x-circle" size={22} color="#fff" />
          <Text style={mcStyles.overlayText}>Odbaci</Text>
        </Animated.View>

        {/* Save overlay (swipe down) */}
        <Animated.View
          pointerEvents="none"
          style={[mcStyles.actionOverlay, mcStyles.saveOverlay, { opacity: saveOverlayOpacity }]}
        >
          <Feather name="bookmark" size={22} color="#fff" />
          <Text style={mcStyles.overlayText}>Spremi</Text>
        </Animated.View>

        {/* Permanent swipe hints */}
        <View style={mcStyles.hintsRow}>
          <View style={[mcStyles.hintPill, { backgroundColor: `${colors.destructive}18`, borderColor: `${colors.destructive}30` }]}>
            <Feather name="chevron-up" size={11} color={colors.destructive} />
            <Text style={[mcStyles.hintText, { color: colors.destructive }]}>odbaci</Text>
          </View>
          <View style={[mcStyles.typeBadge, { backgroundColor: badgeBg, borderColor: badgeColor }]}>
            <Text style={[mcStyles.typeBadgeText, { color: badgeColor }]}>
              {MATCH_LABEL[match.matchType]}
            </Text>
          </View>
          <View style={[mcStyles.hintPill, { backgroundColor: `#22c55e18`, borderColor: `#22c55e30` }]}>
            <Text style={[mcStyles.hintText, { color: "#22c55e" }]}>spremi</Text>
            <Feather name="chevron-down" size={11} color="#22c55e" />
          </View>
        </View>

        {/* Exchange visual */}
        <View style={mcStyles.exchangeRow}>
          <View style={[mcStyles.itemBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Text style={[mcStyles.itemLabel, { color: colors.mutedForeground }]}>Tvoj oglas</Text>
            <Text style={[mcStyles.itemTitle, { color: colors.foreground }]} numberOfLines={2}>
              {match.myListing.title}
            </Text>
            {match.myListing.price != null && (
              <Text style={[mcStyles.itemPrice, { color: colors.primary }]}>{match.myListing.price} €</Text>
            )}
          </View>

          <View
            style={[
              mcStyles.arrowCircle,
              {
                backgroundColor: isBoth ? colors.primary : colors.muted,
                borderColor: isBoth ? colors.primary : colors.border,
              },
            ]}
          >
            <Feather name="repeat" size={14} color={isBoth ? colors.primaryForeground : colors.mutedForeground} />
          </View>

          <View style={[mcStyles.itemBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Text style={[mcStyles.itemLabel, { color: colors.mutedForeground }]}>Njihov oglas</Text>
            <Text style={[mcStyles.itemTitle, { color: colors.foreground }]} numberOfLines={2}>
              {match.theirListing.title}
            </Text>
            {match.theirListing.price != null && (
              <Text style={[mcStyles.itemPrice, { color: colors.primary }]}>{match.theirListing.price} €</Text>
            )}
          </View>
        </View>
      </View>

      {/* Footer — outside PanResponder, freely pressable */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/listing/${match.theirListing.id}`);
        }}
        style={({ pressed }) => [
          mcStyles.footer,
          { borderTopColor: colors.border, backgroundColor: pressed ? colors.muted : "transparent" },
        ]}
      >
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/user/${encodeURIComponent(match.theirListing.userName)}`);
          }}
          style={mcStyles.footerLeft}
        >
          <Feather name="user" size={11} color={colors.mutedForeground} />
          <Text style={[mcStyles.footerUser, { color: colors.secondary }]}>
            {match.theirListing.userName}
          </Text>
          <Text style={[mcStyles.footerDot, { color: colors.mutedForeground }]}>·</Text>
          <Feather name="map-pin" size={11} color={colors.mutedForeground} />
          <Text style={[mcStyles.footerUser, { color: colors.mutedForeground }]}>
            {match.theirListing.location}
          </Text>
        </Pressable>
        <View style={[mcStyles.viewBtn, { backgroundColor: colors.primary }]}>
          <Text style={[mcStyles.viewBtnText, { color: colors.primaryForeground }]}>Otvori →</Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}

// ─── Saved Card ────────────────────────────────────────────────────────────────

function SavedCard({
  listing,
  colors,
  onUnsave,
}: {
  listing: Listing;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  onUnsave: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/listing/${listing.id}`);
      }}
      style={({ pressed }) => [
        savedStyles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <View style={[savedStyles.iconBox, { backgroundColor: colors.muted }]}>
        <Feather name="package" size={20} color={colors.secondary} />
      </View>
      <Text style={[savedStyles.title, { color: colors.foreground }]} numberOfLines={2}>
        {listing.title}
      </Text>
      {listing.price != null && (
        <Text style={[savedStyles.price, { color: colors.primary }]}>{listing.price} €</Text>
      )}
      <View style={savedStyles.meta}>
        <Feather name="map-pin" size={10} color={colors.mutedForeground} />
        <Text style={[savedStyles.metaText, { color: colors.mutedForeground }]}>{listing.location}</Text>
      </View>
      <Pressable
        onPress={(e) => { e.stopPropagation(); onUnsave(); }}
        style={[savedStyles.unsaveBtn, { backgroundColor: colors.muted }]}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Feather name="bookmark" size={12} color={colors.primary} />
      </Pressable>
    </Pressable>
  );
}

// ─── Stat Pill ─────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  color,
  textColor,
  bg,
}: {
  label: string;
  value: number;
  color: string;
  textColor: string;
  bg: string;
}) {
  return (
    <View style={[statStyles.pill, { backgroundColor: bg }]}>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={[statStyles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    listings,
    myName,
    setMyName,
    markAsTraded,
    markAsActive,
    deleteListing,
    updateListing,
    savedListingIds,
    saveListing,
    unsaveListing,
    deleteAllData,
  } = useListings();
  const { user, logout, updateProfile } = useAuth();

  // Local-only edit (no auth)
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(myName);

  // Full profile edit modal (auth required)
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ username: "", phone: "", address: "" });
  const [profileAvatarUri, setProfileAvatarUri] = useState<string | null>(null);
  const [profileAvatarBase64, setProfileAvatarBase64] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState("");

  const [editState, setEditState] = useState<EditState | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [listScrollEnabled, setListScrollEnabled] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const displayName = user?.username ?? myName;

  const myListings = listings.filter((l) => l.isMine);
  const activeCount = myListings.filter((l) => l.status === "active").length;
  const tradedCount = myListings.filter((l) => l.status === "traded").length;

  const allMatches = useMemo(
    () => findTradeMatches(myListings, listings),
    [myListings, listings]
  );
  const visibleMatches = useMemo(
    () => allMatches.filter((m) => !dismissedIds.has(m.theirListing.id)),
    [allMatches, dismissedIds]
  );

  const savedListings = useMemo(
    () => listings.filter((l) => savedListingIds.includes(l.id)),
    [listings, savedListingIds]
  );

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;

  function handleSaveName() {
    if (nameInput.trim()) {
      setMyName(nameInput.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setEditingName(false);
  }

  function openProfileEdit() {
    if (!user) {
      setNameInput(myName);
      setEditingName(true);
      return;
    }
    setProfileForm({
      username: user.username ?? "",
      phone: user.phone ?? "",
      address: user.address ?? "",
    });
    setProfileAvatarUri(user.avatarBase64 ?? null);
    setProfileAvatarBase64(null);
    setProfileError("");
    setEditingProfile(true);
  }

  async function handlePickProfilePhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Dozvola odbijena", "Omogući pristup galeriji u postavkama.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      setProfileAvatarUri(result.assets[0].uri);
      if (result.assets[0].base64) {
        setProfileAvatarBase64(`data:image/jpeg;base64,${result.assets[0].base64}`);
      }
    }
  }

  async function handleSaveProfile() {
    if (!user) return;
    if (!profileForm.username.trim()) { setProfileError("Korisničko ime je obavezno"); return; }
    setProfileSaving(true);
    setProfileError("");
    const data: Parameters<typeof updateProfile>[0] = {
      username: profileForm.username.trim(),
      phone: profileForm.phone,
      address: profileForm.address,
    };
    if (profileAvatarBase64) {
      data.avatarBase64 = profileAvatarBase64;
    } else if (profileAvatarUri === null && user.avatarBase64) {
      // Removed avatar
      data.avatarBase64 = "";
    }
    const result = await updateProfile(data);
    setProfileSaving(false);
    if (result.ok) {
      // Sync name to ListingsContext too
      await setMyName(profileForm.username.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setEditingProfile(false);
    } else {
      setProfileError(result.error ?? "Greška pri snimanju");
    }
  }

  function handleDelete(id: string) {
    Alert.alert("Obriši oglas", "Jesi li siguran?", [
      { text: "Odustani", style: "cancel" },
      {
        text: "Obriši",
        style: "destructive",
        onPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          deleteListing(id);
        },
      },
    ]);
  }

  function openEdit(item: Listing) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditState({
      id: item.id,
      title: item.title,
      description: item.description,
      wantedFor: item.wantedFor,
      priceText: item.price != null ? String(item.price) : "",
      category: item.category,
      location: item.location,
    });
  }

  function handleSaveEdit() {
    if (!editState) return;
    const price = editState.priceText.trim()
      ? parseFloat(editState.priceText.replace(",", "."))
      : null;
    updateListing(editState.id, {
      title: editState.title.trim(),
      description: editState.description.trim(),
      wantedFor: editState.wantedFor.trim(),
      price: price && !isNaN(price) ? price : null,
      category: editState.category,
      location: editState.location,
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setEditState(null);
  }

  const handleDismiss = useCallback((theirId: string) => {
    setDismissedIds((prev) => new Set([...prev, theirId]));
  }, []);

  const handleSaveMatch = useCallback((theirId: string) => {
    saveListing(theirId);
    setDismissedIds((prev) => new Set([...prev, theirId]));
  }, [saveListing]);

  const inputStyle = [
    styles.modalInput,
    { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted },
  ];

  const ListHeader = (
    <View style={[styles.headerSection, { paddingTop: topPad }]}>
      {/* Profile card */}
      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatarRing, { borderColor: colors.secondary }]}>
          {user?.avatarBase64 ? (
            <Image source={{ uri: user.avatarBase64 }} style={styles.avatarImg} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
              <Text style={[styles.avatarText, { color: colors.primary }]}>
                {displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
        </View>
        <Text style={[styles.name, { color: colors.foreground }]}>{displayName}</Text>

        {/* Auth user extra info */}
        {user && (
          <View style={styles.userInfoRows}>
            <View style={styles.userInfoRow}>
              <Feather name="mail" size={12} color={colors.mutedForeground} />
              <Text style={[styles.userInfoText, { color: colors.mutedForeground }]}>{user.email}</Text>
              {user.isVerified && (
                <View style={[styles.verifiedBadge, { backgroundColor: "#1A3A2A" }]}>
                  <Feather name="check" size={9} color="#4ADE80" />
                  <Text style={styles.verifiedText}>Potvrđen</Text>
                </View>
              )}
            </View>
            {user.phone ? (
              <View style={styles.userInfoRow}>
                <Feather name="phone" size={12} color={colors.mutedForeground} />
                <Text style={[styles.userInfoText, { color: colors.mutedForeground }]}>{user.phone}</Text>
              </View>
            ) : null}
            {user.address ? (
              <View style={styles.userInfoRow}>
                <Feather name="map-pin" size={12} color={colors.mutedForeground} />
                <Text style={[styles.userInfoText, { color: colors.mutedForeground }]}>{user.address}</Text>
              </View>
            ) : null}
          </View>
        )}

        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Feather key={i} name="star" size={14} color={colors.primary} />
          ))}
          <Text style={[styles.ratingText, { color: colors.mutedForeground }]}>5,0</Text>
        </View>

        <View style={styles.profileBtns}>
          <Pressable
            onPress={openProfileEdit}
            style={({ pressed }) => [
              styles.editBtn,
              { borderColor: colors.border, backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1, flex: 1 },
            ]}
          >
            <Feather name="edit-2" size={13} color={colors.mutedForeground} />
            <Text style={[styles.editBtnText, { color: colors.mutedForeground }]}>Uredi profil</Text>
          </Pressable>
          {user && (
            <Pressable
              onPress={async () => {
                Alert.alert("Odjava", "Odjaviš se s profila?", [
                  { text: "Odustani", style: "cancel" },
                  { text: "Odjava", style: "destructive", onPress: () => logout() },
                ]);
              }}
              style={({ pressed }) => [
                styles.editBtn,
                { borderColor: `${colors.destructive}40`, backgroundColor: `${colors.destructive}10`, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Feather name="log-out" size={13} color={colors.destructive} />
              <Text style={[styles.editBtnText, { color: colors.destructive }]}>Odjava</Text>
            </Pressable>
          )}
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.stats}>
          <StatPill label="Aktivni" value={activeCount} color={colors.primary} textColor={colors.primaryForeground} bg={colors.muted} />
          <StatPill label="Zamijenjeni" value={tradedCount} color={colors.secondary} textColor={colors.secondaryForeground} bg={colors.muted} />
          <StatPill label="Ukupno" value={myListings.length} color={colors.mutedForeground} textColor={colors.foreground} bg={colors.muted} />
        </View>
      </View>

      {/* Trade suggestions */}
      <View style={styles.suggestSection}>
        <View style={styles.suggestTitleRow}>
          <View style={[styles.suggestTitleBadge, { backgroundColor: colors.muted, borderColor: colors.primary }]}>
            <Feather name="zap" size={13} color={colors.primary} />
            <Text style={[styles.suggestTitleText, { color: colors.primary }]}>Prijedlozi zamjene</Text>
          </View>
          <Text style={[styles.suggestCount, { color: colors.mutedForeground }]}>
            {visibleMatches.length} {visibleMatches.length === 1 ? "podudaranje" : "podudaranja"}
          </Text>
        </View>

        {visibleMatches.length === 0 ? (
          <View style={[styles.suggestEmpty, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Feather name="search" size={28} color={colors.mutedForeground} />
            <Text style={[styles.suggestEmptyTitle, { color: colors.foreground }]}>Nema prijedloga</Text>
            <Text style={[styles.suggestEmptySub, { color: colors.mutedForeground }]}>
              Dodaj oglase s opisom što tražiš i prijedlozi će se automatski pojaviti
            </Text>
          </View>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestScroll}
            decelerationRate="fast"
          >
            {visibleMatches.map((match, idx) => (
              <MatchCard
                key={`${match.myListing.id}-${match.theirListing.id}-${idx}`}
                match={match}
                colors={colors}
                onDismiss={() => handleDismiss(match.theirListing.id)}
                onSave={() => handleSaveMatch(match.theirListing.id)}
                onSwipeStart={() => setListScrollEnabled(false)}
                onSwipeEnd={() => setListScrollEnabled(true)}
              />
            ))}
          </ScrollView>
        )}
      </View>

      {/* Saved listings */}
      {savedListings.length > 0 && (
        <View style={styles.suggestSection}>
          <View style={styles.suggestTitleRow}>
            <View style={[styles.suggestTitleBadge, { backgroundColor: colors.muted, borderColor: colors.secondary }]}>
              <Feather name="bookmark" size={13} color={colors.secondary} />
              <Text style={[styles.suggestTitleText, { color: colors.secondary }]}>Spremljeno</Text>
            </View>
            <Text style={[styles.suggestCount, { color: colors.mutedForeground }]}>
              {savedListings.length} {savedListings.length === 1 ? "oglas" : "oglasa"}
            </Text>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestScroll}
            decelerationRate="fast"
          >
            {savedListings.map((listing) => (
              <SavedCard
                key={listing.id}
                listing={listing}
                colors={colors}
                onUnsave={() => unsaveListing(listing.id)}
              />
            ))}
          </ScrollView>
        </View>
      )}

      {/* GDPR / legal section */}
      <View style={[styles.gdprSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.gdprTitleRow}>
          <Feather name="shield" size={13} color={colors.mutedForeground} />
          <Text style={[styles.gdprTitle, { color: colors.mutedForeground }]}>Privatnost i podaci</Text>
        </View>
        <View style={styles.gdprLinks}>
          <Pressable
            onPress={() => router.push("/terms")}
            style={({ pressed }) => [styles.gdprLink, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="file-text" size={12} color={colors.secondary} />
            <Text style={[styles.gdprLinkText, { color: colors.secondary }]}>Uvjeti korištenja</Text>
          </Pressable>
          <View style={[styles.gdprDivider, { backgroundColor: colors.border }]} />
          <Pressable
            onPress={() => router.push("/privacy")}
            style={({ pressed }) => [styles.gdprLink, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="lock" size={12} color={colors.secondary} />
            <Text style={[styles.gdprLinkText, { color: colors.secondary }]}>Politika privatnosti</Text>
          </Pressable>
        </View>
        <Pressable
          onPress={() => {
            Alert.alert(
              "Izbriši sve podatke",
              "Ovo će trajno obrisati sve tvoje oglase, poruke, spremljene stavke i profil. Radnja se ne može poništiti.",
              [
                { text: "Odustani", style: "cancel" },
                {
                  text: "Izbriši sve",
                  style: "destructive",
                  onPress: async () => {
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    await deleteAllData();
                    router.replace("/onboarding");
                  },
                },
              ]
            );
          }}
          style={({ pressed }) => [
            styles.gdprDeleteBtn,
            { borderColor: colors.destructive, opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Feather name="trash-2" size={13} color={colors.destructive} />
          <Text style={[styles.gdprDeleteText, { color: colors.destructive }]}>
            Izbriši sve moje podatke (GDPR)
          </Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Moji oglasi</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        ref={flatListRef}
        data={myListings}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={ListHeader}
        scrollEnabled={listScrollEnabled}
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <ListingCard listing={item} />
            {item.isMine && (
              <View style={styles.actions}>
                <Pressable
                  onPress={() => openEdit(item)}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Feather name="edit-2" size={12} color={colors.mutedForeground} />
                </Pressable>
                {item.status === "active" ? (
                  <Pressable
                    onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); markAsTraded(item.id); }}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      styles.actionBtnFlex,
                      { backgroundColor: "#2E7D4F", opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <Feather name="check" size={12} color="#fff" />
                    <Text style={styles.actionBtnText}>Zamijenjeno</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); markAsActive(item.id); }}
                    style={({ pressed }) => [
                      styles.actionBtn,
                      styles.actionBtnFlex,
                      { backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.secondary, opacity: pressed ? 0.8 : 1 },
                    ]}
                  >
                    <Feather name="rotate-ccw" size={12} color={colors.secondary} />
                    <Text style={[styles.actionBtnText, { color: colors.secondary }]}>Aktiviraj</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => handleDelete(item.id)}
                  style={({ pressed }) => [
                    styles.actionBtn,
                    { backgroundColor: colors.muted, borderWidth: 1, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Feather name="trash-2" size={12} color={colors.destructive} />
                </Pressable>
              </View>
            )}
          </View>
        )}
        contentContainerStyle={[
          styles.list,
          myListings.length === 0 && styles.listEmpty,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 60 : 100) },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="package"
            title="Nemaš oglasa"
            subtitle="Postavi oglas i počni trampati!"
          />
        }
      />

      {/* Name modal (guest / no-auth) */}
      <Modal visible={editingName} transparent animationType="fade" onRequestClose={() => setEditingName(false)}>
        <Pressable style={styles.overlay} onPress={() => setEditingName(false)}>
          <Pressable
            style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {}}
          >
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Promijeni ime</Text>
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              style={inputStyle}
              autoFocus
              maxLength={40}
              onSubmitEditing={handleSaveName}
              returnKeyType="done"
            />
            <View style={styles.modalBtns}>
              <Pressable
                onPress={() => setEditingName(false)}
                style={[styles.modalBtn, { backgroundColor: colors.muted }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.mutedForeground }]}>Odustani</Text>
              </Pressable>
              <Pressable onPress={handleSaveName} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={[styles.modalBtnText, { color: colors.primaryForeground }]}>Spremi</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Full profile edit modal (auth) */}
      <Modal visible={editingProfile} transparent animationType="slide" onRequestClose={() => setEditingProfile(false)}>
        <Pressable style={styles.overlay} onPress={() => setEditingProfile(false)}>
          <Pressable
            style={[styles.editModal, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {}}
          >
            <View style={styles.editModalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Uredi profil</Text>
              <Pressable onPress={() => setEditingProfile(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.editModalBody}>
              {/* Avatar */}
              <View style={styles.editAvatarRow}>
                <Pressable onPress={handlePickProfilePhoto} style={[styles.editAvatarBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  {profileAvatarUri ? (
                    <Image source={{ uri: profileAvatarUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
                  ) : (
                    <Feather name="user" size={28} color={colors.mutedForeground} />
                  )}
                  <View style={[styles.editAvatarOverlay, { backgroundColor: "rgba(0,0,0,0.4)" }]}>
                    <Feather name="camera" size={14} color="#fff" />
                  </View>
                </Pressable>
                <View style={{ flex: 1, gap: 6 }}>
                  <Pressable
                    onPress={handlePickProfilePhoto}
                    style={({ pressed }) => [styles.photoBtn, { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
                  >
                    <Feather name="image" size={13} color={colors.primary} />
                    <Text style={[styles.photoBtnText, { color: colors.primary }]}>
                      {profileAvatarUri ? "Promijeni sliku" : "Dodaj profilnu sliku"}
                    </Text>
                  </Pressable>
                  {profileAvatarUri && (
                    <Pressable onPress={() => { setProfileAvatarUri(null); setProfileAvatarBase64(null); }}>
                      <Text style={[styles.removePhotoText, { color: colors.destructive }]}>Ukloni sliku</Text>
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Email (read-only) */}
              {user && (
                <View style={styles.editFieldGroup}>
                  <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Email adresa</Text>
                  <View style={[styles.editInputReadonly, { backgroundColor: `${colors.muted}88`, borderColor: colors.border }]}>
                    <Text style={[styles.editInputReadonlyText, { color: colors.mutedForeground }]}>{user.email}</Text>
                    {user.isVerified && <Feather name="check-circle" size={14} color="#4ADE80" />}
                  </View>
                </View>
              )}

              <View style={styles.editFieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Korisničko ime *</Text>
                <TextInput
                  value={profileForm.username}
                  onChangeText={(v) => setProfileForm((f) => ({ ...f, username: v }))}
                  style={inputStyle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={40}
                />
              </View>

              <View style={styles.editFieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Adresa</Text>
                <TextInput
                  value={profileForm.address}
                  onChangeText={(v) => setProfileForm((f) => ({ ...f, address: v }))}
                  style={inputStyle}
                  placeholder="npr. Ilica 10, Zagreb"
                  placeholderTextColor={colors.mutedForeground}
                  autoCapitalize="words"
                />
              </View>

              <View style={styles.editFieldGroup}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Broj mobitela</Text>
                <TextInput
                  value={profileForm.phone}
                  onChangeText={(v) => setProfileForm((f) => ({ ...f, phone: v }))}
                  style={inputStyle}
                  placeholder="npr. 091 123 4567"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                />
              </View>

              {profileError ? (
                <View style={[styles.profileErrorBox, { backgroundColor: `${colors.destructive}18`, borderColor: `${colors.destructive}40` }]}>
                  <Feather name="alert-circle" size={13} color={colors.destructive} />
                  <Text style={[styles.profileErrorText, { color: colors.destructive }]}>{profileError}</Text>
                </View>
              ) : null}
            </ScrollView>

            <View style={styles.modalBtns}>
              <Pressable
                onPress={() => setEditingProfile(false)}
                style={[styles.modalBtn, { backgroundColor: colors.muted }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.mutedForeground }]}>Odustani</Text>
              </Pressable>
              <Pressable
                onPress={handleSaveProfile}
                disabled={profileSaving}
                style={[styles.modalBtn, { backgroundColor: colors.primary, flex: 1 }]}
              >
                {profileSaving
                  ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                  : <Text style={[styles.modalBtnText, { color: colors.primaryForeground }]}>Spremi promjene</Text>}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit listing modal */}
      <Modal visible={!!editState} transparent animationType="slide" onRequestClose={() => setEditState(null)}>
        <Pressable style={styles.overlay} onPress={() => setEditState(null)}>
          <Pressable
            style={[styles.editModal, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {}}
          >
            <View style={styles.editModalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Uredi oglas</Text>
              <Pressable onPress={() => setEditState(null)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {editState && (
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.editModalBody}
              >
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Naslov</Text>
                <TextInput
                  value={editState.title}
                  onChangeText={(v) => setEditState((s) => s ? { ...s, title: v } : s)}
                  style={inputStyle}
                  maxLength={80}
                />
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Opis</Text>
                <TextInput
                  value={editState.description}
                  onChangeText={(v) => setEditState((s) => s ? { ...s, description: v } : s)}
                  style={[inputStyle, styles.multilineInput]}
                  multiline
                  maxLength={500}
                  textAlignVertical="top"
                />
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Što želiš zauzvrat</Text>
                <TextInput
                  value={editState.wantedFor}
                  onChangeText={(v) => setEditState((s) => s ? { ...s, wantedFor: v } : s)}
                  style={inputStyle}
                  maxLength={120}
                />
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Vrijednost u €</Text>
                <TextInput
                  value={editState.priceText}
                  onChangeText={(v) =>
                    setEditState((s) => s ? { ...s, priceText: v.replace(/[^0-9.,]/g, "") } : s)
                  }
                  style={inputStyle}
                  keyboardType="decimal-pad"
                  maxLength={10}
                  placeholder="Opcionalno"
                  placeholderTextColor={colors.mutedForeground}
                />
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Kategorija</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {CATEGORIES.filter((c) => c !== "Sve").map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setEditState((s) => s ? { ...s, category: cat } : s)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: editState.category === cat ? colors.primary : colors.muted,
                          borderColor: editState.category === cat ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: editState.category === cat ? colors.primaryForeground : colors.mutedForeground },
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Lokacija</Text>
                <View style={styles.locationGrid}>
                  {LOCATION_OPTIONS.map((loc) => (
                    <Pressable
                      key={loc}
                      onPress={() => setEditState((s) => s ? { ...s, location: loc } : s)}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: editState.location === loc ? colors.primary : colors.muted,
                          borderColor: editState.location === loc ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: editState.location === loc ? colors.primaryForeground : colors.mutedForeground },
                        ]}
                      >
                        {loc}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.modalBtns}>
                  <Pressable
                    onPress={() => setEditState(null)}
                    style={[styles.modalBtn, { backgroundColor: colors.muted }]}
                  >
                    <Text style={[styles.modalBtnText, { color: colors.mutedForeground }]}>Odustani</Text>
                  </Pressable>
                  <Pressable onPress={handleSaveEdit} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                    <Text style={[styles.modalBtnText, { color: colors.primaryForeground }]}>Spremi</Text>
                  </Pressable>
                </View>
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const mcStyles = StyleSheet.create({
  card: {
    width: 296,
    borderRadius: 16,
    borderWidth: 1.5,
    overflow: "hidden",
  },
  swipeArea: {
    padding: 14,
    gap: 12,
  },
  hintsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hintPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  hintText: { fontSize: 10, fontFamily: "Inter_500Medium" },
  typeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  typeBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  exchangeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 3,
    minHeight: 78,
    justifyContent: "center",
  },
  itemLabel: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  itemTitle: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 16 },
  itemPrice: { fontSize: 13, fontFamily: "Inter_700Bold" },
  arrowCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingBottom: 2,
  },
  footerLeft: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  footerUser: { fontSize: 11, fontFamily: "Inter_400Regular" },
  footerDot: { fontSize: 11 },
  viewBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  viewBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  actionOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    zIndex: 10,
    borderRadius: 14,
  },
  dismissOverlay: {
    top: 0,
    backgroundColor: "#ef4444cc",
  },
  saveOverlay: {
    bottom: 0,
    backgroundColor: "#22c55ecc",
  },
  overlayText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
});

const savedStyles = StyleSheet.create({
  card: {
    width: 140,
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    gap: 6,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  title: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 16 },
  price: { fontSize: 13, fontFamily: "Inter_700Bold" },
  meta: { flexDirection: "row", alignItems: "center", gap: 3 },
  metaText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  unsaveBtn: {
    alignSelf: "flex-start",
    padding: 6,
    borderRadius: 8,
    marginTop: 2,
  },
});

const statStyles = StyleSheet.create({
  pill: { flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10, gap: 2 },
  value: { fontSize: 20, fontFamily: "Inter_700Bold" },
  label: { fontSize: 10, fontFamily: "Inter_400Regular" },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerSection: { paddingHorizontal: 16, gap: 16, paddingBottom: 8 },
  profileCard: { borderRadius: 18, borderWidth: 1, padding: 20, alignItems: "center", gap: 10 },
  avatarRing: {
    width: 82,
    height: 82,
    borderRadius: 41,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
  },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 28, fontFamily: "Inter_700Bold" },
  name: { fontSize: 20, fontFamily: "Inter_700Bold" },
  starsRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 13, fontFamily: "Inter_400Regular", marginLeft: 4 },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  editBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  divider: { width: "100%", height: 1, marginVertical: 4 },
  stats: { flexDirection: "row", gap: 8, width: "100%" },
  suggestSection: { gap: 10 },
  suggestTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  suggestTitleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  suggestTitleText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  suggestCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  suggestScroll: { gap: 10, paddingRight: 16 },
  suggestEmpty: { borderRadius: 16, borderWidth: 1, padding: 24, alignItems: "center", gap: 8 },
  suggestEmptyTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  suggestEmptySub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 18,
  },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", paddingTop: 4 },
  list: { paddingHorizontal: 12, paddingTop: 4 },
  listEmpty: { flex: 1 },
  columnWrapper: { gap: 10, paddingHorizontal: 4, marginBottom: 0 },
  cardWrapper: { flex: 1 },
  actions: { flexDirection: "row", gap: 5, marginTop: -8, marginBottom: 12, paddingHorizontal: 2 },
  actionBtn: { alignItems: "center", justifyContent: "center", paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  actionBtnFlex: { flex: 1, flexDirection: "row", gap: 4 },
  actionBtnText: { color: "#fff", fontSize: 11, fontFamily: "Inter_500Medium" },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  modal: { width: "100%", borderRadius: 16, borderWidth: 1, padding: 20, gap: 14 },
  editModal: { width: "100%", borderRadius: 20, borderWidth: 1, padding: 20, maxHeight: "88%" },
  editModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  editModalBody: { gap: 10, paddingBottom: 8 },
  modalTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  multilineInput: { minHeight: 80, textAlignVertical: "top", paddingTop: 11 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.4, textTransform: "uppercase" },
  chips: { gap: 8, paddingRight: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  locationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10 },
  modalBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  gdprSection: { borderRadius: 14, borderWidth: 1, padding: 14, gap: 12, marginBottom: 4 },
  gdprTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  gdprTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.5 },
  gdprLinks: { flexDirection: "row", alignItems: "center", gap: 0 },
  gdprLink: { flexDirection: "row", alignItems: "center", gap: 5, flex: 1, paddingVertical: 4 },
  gdprLinkText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  gdprDivider: { width: 1, height: 14, marginHorizontal: 8 },
  gdprDeleteBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1 },
  gdprDeleteText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  // Auth profile styles
  avatarImg: { width: 72, height: 72, borderRadius: 36 },
  userInfoRows: { gap: 5, alignSelf: "stretch" },
  userInfoRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  userInfoText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  verifiedText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#4ADE80" },
  profileBtns: { flexDirection: "row", gap: 8, alignSelf: "stretch" },
  editAvatarRow: { flexDirection: "row", gap: 14, alignItems: "center", marginBottom: 4 },
  editAvatarBox: { width: 72, height: 72, borderRadius: 36, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  editAvatarOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, height: 24, alignItems: "center", justifyContent: "center" },
  photoBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1.5 },
  photoBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  removePhotoText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  editFieldGroup: { gap: 5 },
  editInputReadonly: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, gap: 8 },
  editInputReadonlyText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular" },
  profileErrorBox: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 8, padding: 10 },
  profileErrorText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1 },
});
