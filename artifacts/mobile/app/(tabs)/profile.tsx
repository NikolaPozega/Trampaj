import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Updates from "expo-updates";
import * as LocalAuthentication from "expo-local-authentication";
import { compressImage } from "@/utils/compressImage";
import { Image } from "expo-image";
import { router, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AdBannerSlot } from "@/components/AdBanner";
import { EmptyState } from "@/components/EmptyState";
import { WebDownloadScreen } from "@/components/WebDownloadScreen";
import { ListingCard } from "@/components/ListingCard";

import { CATEGORIES, type Listing, useListings } from "@/context/ListingsContext";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { findTradeMatches, type TradeMatch } from "@/services/tradeMatches";
import { useChat } from "@/context/ChatContext";

const IS_WEB = (Platform.OS as string) === "web";

interface EditState {
  id: string;
  title: string;
  description: string;
  wantedFor: string;
  priceText: string;
  category: string;
  location: string;
  condition: import("@/context/ListingsContext").Condition | null;
}

const LOCATION_OPTIONS = [
  "Zagreb", "Split", "Rijeka", "Osijek",
  "Sarajevo", "Beograd", "Ljubljana", "Ostalo",
];

const BIO_ASKED_KEY = "@trampaj_bio_asked_v1";
const BIO_ENABLED_KEY = "@trampaj_bio_enabled_v1";
const BIO_CREDS_KEY = "@trampaj_bio_creds_v1";

const MATCH_LABEL: Record<TradeMatch["matchType"], string> = {
  both: "Obostrana zamjena ✦",
  i_want: "Ti tražiš ovo",
  they_want: "Oni traže što ti imaš",
};

// ─── Match Card (tap buttons) ──────────────────────────────────────────────────

function MatchCard({
  match,
  colors,
  onDismiss,
  onSave,
}: {
  match: TradeMatch;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  onDismiss: () => void;
  onSave: () => void;
}) {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  function animateOut(dir: "up" | "down", cb: () => void) {
    Haptics.notificationAsync(
      dir === "up"
        ? Haptics.NotificationFeedbackType.Warning
        : Haptics.NotificationFeedbackType.Success
    );
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: dir === "up" ? -260 : 260,
        duration: 220,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(cb);
  }

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
      {/* Card body */}
      <View style={mcStyles.cardBody}>
        {/* Badge row */}
        <View style={mcStyles.badgeRow}>
          <View style={[mcStyles.typeBadge, { backgroundColor: badgeBg, borderColor: badgeColor }]}>
            <Text style={[mcStyles.typeBadgeText, { color: badgeColor }]}>
              {MATCH_LABEL[match.matchType]}
            </Text>
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

        {/* Action buttons — X (odbaci) i ✓ (spremi) */}
        <View style={mcStyles.actionRow}>
          <Pressable
            onPress={() => animateOut("up", onDismiss)}
            style={({ pressed }) => [
              mcStyles.actionBtn,
              mcStyles.dismissBtn,
              { opacity: pressed ? 0.75 : 1 },
            ]}
            hitSlop={8}
          >
            <Feather name="x" size={22} color="#fff" />
            <Text style={mcStyles.actionBtnLabel}>Odbaci</Text>
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push(`/listing/${match.theirListing.id}`);
            }}
            style={({ pressed }) => [mcStyles.viewBtn, { backgroundColor: colors.muted, borderColor: colors.border, opacity: pressed ? 0.8 : 1 }]}
          >
            <Text style={[mcStyles.viewBtnText, { color: colors.foreground }]}>Otvori</Text>
            <Feather name="arrow-right" size={12} color={colors.foreground} />
          </Pressable>

          <Pressable
            onPress={() => animateOut("down", onSave)}
            style={({ pressed }) => [
              mcStyles.actionBtn,
              mcStyles.saveBtn,
              { opacity: pressed ? 0.75 : 1 },
            ]}
            hitSlop={8}
          >
            <Feather name="check" size={22} color="#fff" />
            <Text style={mcStyles.actionBtnLabel}>Spremi</Text>
          </Pressable>
        </View>
      </View>

      {/* Footer — user & location */}
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/user/${encodeURIComponent(match.theirListing.userName)}`);
        }}
        style={({ pressed }) => [
          mcStyles.footer,
          { borderTopColor: colors.border, backgroundColor: pressed ? colors.muted : "transparent" },
        ]}
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
  onPress,
  active,
}: {
  label: string;
  value: number;
  color: string;
  textColor: string;
  bg: string;
  onPress?: () => void;
  active?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        statStyles.pill,
        { backgroundColor: bg, opacity: pressed ? 0.75 : 1 },
        active && { borderWidth: 1.5, borderColor: color },
      ]}
      onPress={onPress}
    >
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={[statStyles.label, { color: textColor }]}>{label}</Text>
    </Pressable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const {
    listings,
    myListings,
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
    blockedUserNames,
    unblockUser,
    refreshMyListings,
  } = useListings();
  const { user, logout, updateProfile, refreshUser } = useAuth();
  const { conversations, unreadCount } = useChat();

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

  const [bioEnabled, setBioEnabled] = useState(false);
  const [bioPasswordInput, setBioPasswordInput] = useState("");
  const [showBioPasswordModal, setShowBioPasswordModal] = useState(false);
  const [bioActivating, setBioActivating] = useState(false);
  const [showBioDisableModal, setShowBioDisableModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(BIO_ENABLED_KEY).then((v) => setBioEnabled(v === "yes"));
  }, []);

  function handleBioEnable() {
    setBioPasswordInput("");
    setShowBioPasswordModal(true);
  }

  async function confirmBioEnable() {
    if (!bioPasswordInput || !user) return;
    setBioActivating(true);
    try {
      const _FALLBACK = "88ef2a6c-7a33-487b-979b-872bea2e7663-00-2xiyym1yox3cc.riker.replit.dev";
      const API_BASE = `https://${process.env["EXPO_PUBLIC_DOMAIN"] ?? _FALLBACK}/api`;
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: user.username, password: bioPasswordInput }),
      });
      if (!res.ok) {
        setBioActivating(false);
        setBioPasswordInput("");
        Alert.alert("Pogrešna lozinka", "Unesi ispravnu lozinku za aktivaciju.");
        return;
      }
      await AsyncStorage.setItem(BIO_ENABLED_KEY, "yes");
      await AsyncStorage.setItem(BIO_ASKED_KEY, "asked");
      await AsyncStorage.setItem(BIO_CREDS_KEY, JSON.stringify({ username: user.username, password: bioPasswordInput }));
      setBioEnabled(true);
      setShowBioPasswordModal(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      Alert.alert("Greška", "Provjeri vezu i pokušaj ponovo.");
    } finally {
      setBioActivating(false);
    }
  }

  function handleBioDisable() {
    setShowBioDisableModal(true);
  }

  async function confirmBioDisable() {
    await AsyncStorage.multiRemove([BIO_ENABLED_KEY, BIO_ASKED_KEY, BIO_CREDS_KEY]);
    setBioEnabled(false);
    setShowBioDisableModal(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }

  async function handleDeleteAccount() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(
      "Izbriši račun i sve podatke",
      "Ovo će trajno izbrisati tvoj profil, sve oglase, poruke i osobne podatke. Ova radnja je nepovratna.\n\nJesi li siguran?",
      [
        { text: "Odustani", style: "cancel" },
        {
          text: "Izbriši sve",
          style: "destructive",
          onPress: async () => {
            try {
              if (user) {
                await logout();
              }
              await deleteAllData();
              await AsyncStorage.multiRemove([BIO_ENABLED_KEY, BIO_ASKED_KEY, BIO_CREDS_KEY]);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              router.replace("/(tabs)");
            } catch {
              Alert.alert("Greška", "Nije uspjelo brisanje. Pokušaj ponovo.");
            }
          },
        },
      ]
    );
  }

  const [editState, setEditState] = useState<EditState | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const { width: screenWidth } = useWindowDimensions();
  const snapPad = Math.max(0, (screenWidth - 32 - 296) / 2);
  const [refreshing, setRefreshing] = useState(false);
  const [updating, setUpdating] = useState(false);

  async function handleCheckUpdate() {
    if (IS_WEB) return;
    setUpdating(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const check = await Updates.checkForUpdateAsync();
      if (check.isAvailable) {
        await Updates.fetchUpdateAsync();
        Alert.alert(
          "Nova verzija dostupna",
          "Nadogradnja je preuzeta. Restartaj aplikaciju.",
          [
            { text: "Restartaj sada", onPress: () => Updates.reloadAsync() },
            { text: "Kasnije", style: "cancel" },
          ]
        );
      } else {
        Alert.alert("Aplikacija je aktualna", "Koristiš najnoviju verziju.");
      }
    } catch {
      Alert.alert("Greška", "Provjera ažuriranja nije uspjela. Provjeri vezu.");
    } finally {
      setUpdating(false);
    }
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([refreshUser(), refreshMyListings()]);
    setRefreshing(false);
  }
  const flatListRef = useRef<FlatList>(null);
  const headerHeightRef = useRef(480);

  const displayName = user?.username ?? myName;

  const activeCount = myListings.filter((l) => l.status === "active" && l.moderationStatus === "active").length;
  const tradedCount = myListings.filter((l) => l.status === "traded").length;
  const pendingCount = myListings.filter((l) => l.moderationStatus === "pending").length;
  const [statusFilter, setStatusFilter] = useState<"active" | "traded" | "pending" | null>(null);
  const filteredMyListings = statusFilter === "pending"
    ? myListings.filter((l) => l.moderationStatus === "pending")
    : statusFilter
    ? myListings.filter((l) => l.status === statusFilter)
    : myListings;

  // Separate scroll signal so repeated taps on the same filter still scroll
  const [scrollSignal, setScrollSignal] = useState(0);

  function filterAndScroll(filter: "active" | "traded" | "pending" | null) {
    setStatusFilter(filter);
    setScrollSignal((s) => s + 1);
  }

  // Scroll to very top (header) when tab gets focus
  useFocusEffect(
    useCallback(() => {
      flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, [])
  );

  // Every time scrollSignal changes (i.e. any stat button tap), scroll to listings
  useEffect(() => {
    if (scrollSignal === 0) return;
    setTimeout(() => {
      flatListRef.current?.scrollToOffset({ offset: headerHeightRef.current, animated: true });
    }, 80);
  }, [scrollSignal]);

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

  const topPad = IS_WEB ? 16 : insets.top + 8;

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
    });
    if (!result.canceled && result.assets[0]) {
      const compressed = await compressImage(result.assets[0].uri, 400, 0.65);
      setProfileAvatarUri(compressed.uri);
      setProfileAvatarBase64(`data:image/jpeg;base64,${compressed.base64}`);
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
      condition: item.condition ?? null,
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
      condition: editState.condition,
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

  const ListHeader = () => (
    <View style={[styles.headerSection, { paddingTop: topPad }]} onLayout={(e) => { headerHeightRef.current = e.nativeEvent.layout.height; }}>
      {/* Profile card */}
      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {/* Envelope button — top-right corner */}
        <Pressable
          onPress={() => router.push({ pathname: "/inbox" })}
          style={({ pressed }) => [
            styles.inboxBtn,
            { backgroundColor: colors.muted, borderColor: unreadCount > 0 ? `${colors.secondary}60` : colors.border, opacity: pressed ? 0.75 : 1 },
          ]}
        >
          <Feather name="mail" size={16} color={unreadCount > 0 ? colors.secondary : colors.mutedForeground} />
          {unreadCount > 0 && (
            <View style={[styles.inboxBadge, { backgroundColor: colors.secondary }]}>
              <Text style={styles.inboxBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          )}
        </Pressable>

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
              onPress={() => setShowLogoutModal(true)}
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

        {/* Biometric login toggle */}
        {user && (
          <Pressable
            onPress={bioEnabled ? handleBioDisable : handleBioEnable}
            style={({ pressed }) => [{
              flexDirection: "row" as const, alignItems: "center" as const, gap: 8,
              paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, marginTop: 6,
              backgroundColor: bioEnabled ? `${colors.secondary}18` : colors.muted,
              borderWidth: 1,
              borderColor: bioEnabled ? `${colors.secondary}50` : colors.border,
              opacity: pressed ? 0.75 : 1,
            }]}
          >
            <Feather name="lock" size={13} color={bioEnabled ? colors.secondary : colors.mutedForeground} />
            <Text style={{ flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: bioEnabled ? colors.secondary : colors.mutedForeground }}>
              Biometrijska prijava
            </Text>
            <View style={{
              paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8,
              backgroundColor: bioEnabled ? colors.secondary : colors.border,
            }}>
              <Text style={{ fontSize: 10, fontFamily: "Inter_600SemiBold", color: bioEnabled ? "#08152E" : colors.mutedForeground }}>
                {bioEnabled ? "AKTIVNA" : "NEAKTIVNA"}
              </Text>
            </View>
          </Pressable>
        )}

        {/* App update section — native only */}
        {!IS_WEB && (
          <View style={[styles.gdprSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.gdprTitleRow}>
              <Feather name="smartphone" size={12} color={colors.mutedForeground} />
              <Text style={[styles.gdprTitle, { color: colors.mutedForeground }]}>Aplikacija</Text>
            </View>
            <Pressable
              onPress={handleCheckUpdate}
              disabled={updating}
              style={({ pressed }) => [styles.gdprDeleteBtn, {
                borderColor: `${colors.secondary}40`,
                opacity: pressed || updating ? 0.7 : 1,
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
              }]}
            >
              {updating
                ? <ActivityIndicator size="small" color={colors.secondary} />
                : <Feather name="download-cloud" size={14} color={colors.secondary} />
              }
              <Text style={{ flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: colors.secondary }}>
                {updating ? "Provjera ažuriranja…" : "Provjeri ažuriranja"}
              </Text>
              {!updating && <Feather name="chevron-right" size={13} color={colors.secondary} />}
            </Pressable>
          </View>
        )}

        {/* GDPR / Legal section */}
        {user && (
          <View style={[styles.gdprSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.gdprTitleRow}>
              <Feather name="shield" size={12} color={colors.mutedForeground} />
              <Text style={[styles.gdprTitle, { color: colors.mutedForeground }]}>Privatnost i pravni uvjeti</Text>
            </View>
            <View style={styles.gdprLinks}>
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/privacy"); }}
                style={styles.gdprLink}
              >
                <Feather name="lock" size={12} color={colors.secondary} />
                <Text style={[styles.gdprLinkText, { color: colors.secondary }]}>Politika privatnosti</Text>
              </Pressable>
              <View style={[styles.gdprDivider, { backgroundColor: colors.border }]} />
              <Pressable
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push("/terms"); }}
                style={styles.gdprLink}
              >
                <Feather name="file-text" size={12} color={colors.secondary} />
                <Text style={[styles.gdprLinkText, { color: colors.secondary }]}>Uvjeti korištenja</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={handleDeleteAccount}
              style={({ pressed }) => [styles.gdprDeleteBtn, { borderColor: `${colors.destructive}40`, opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="trash-2" size={13} color={colors.destructive} />
              <Text style={[styles.gdprDeleteText, { color: colors.destructive }]}>Izbriši račun i sve podatke</Text>
            </Pressable>
          </View>
        )}


        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <View style={styles.stats}>
          <StatPill label="Aktivni" value={activeCount} color={colors.primary} textColor={colors.foreground} bg={colors.muted}
            active={statusFilter === "active"}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); filterAndScroll("active"); }}
          />
          <StatPill label="Zamijenjeni" value={tradedCount} color={colors.secondary} textColor={colors.foreground} bg={colors.muted}
            active={statusFilter === "traded"}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); filterAndScroll("traded"); }}
          />
          {pendingCount > 0 && (
            <StatPill label="Na čekanju" value={pendingCount} color="#F5C100" textColor={colors.foreground} bg={colors.muted}
              active={statusFilter === "pending"}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); filterAndScroll("pending"); }}
            />
          )}
          <StatPill label="Svi" value={myListings.length} color={colors.mutedForeground} textColor={colors.foreground} bg={colors.muted}
            active={statusFilter === null}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); filterAndScroll(null); }}
          />
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
            contentContainerStyle={{ paddingHorizontal: snapPad, gap: 10 }}
            decelerationRate="fast"
            snapToInterval={306}
            snapToAlignment="start"
            disableIntervalMomentum
          >
            {visibleMatches.map((match, idx) => (
              <MatchCard
                key={`${match.myListing.id}-${match.theirListing.id}-${idx}`}
                match={match}
                colors={colors}
                onDismiss={() => handleDismiss(match.theirListing.id)}
                onSave={() => handleSaveMatch(match.theirListing.id)}
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

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
        Moji oglasi{statusFilter === "active" ? " · Aktivni" : statusFilter === "traded" ? " · Zamijenjeni" : ""}
      </Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Fixed top ad banner — right below status bar ──────────────────── */}
      <View style={[styles.fixedAdTop, { paddingTop: insets.top + 4, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <AdBannerSlot size="small" seed="profile-top" />
      </View>

      <FlatList
        ref={flatListRef}
        data={filteredMyListings}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={ListHeader}
        keyboardShouldPersistTaps="always"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#F5C100"
            colors={["#F5C100"]}
          />
        }
        renderItem={({ item }) => (
          <View style={styles.cardWrapper}>
            <ListingCard listing={item} />
            {item.moderationStatus === "pending" && (
              <View style={styles.pendingOverlay} pointerEvents="none">
                <Text style={styles.pendingOverlayText}>⏳ Na čekanju</Text>
              </View>
            )}
            {item.moderationStatus === "rejected" && (
              <View style={[styles.pendingOverlay, { backgroundColor: "rgba(239,68,68,0.82)" }]} pointerEvents="none">
                <Text style={styles.pendingOverlayText}>❌ Odbijeno</Text>
              </View>
            )}
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
          { paddingBottom: insets.bottom + (IS_WEB ? 104 : 80) },
        ]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            icon="package"
            title="Nemaš oglasa"
            subtitle="Postavi oglas i počni trampati!"
          />
        }
        ListFooterComponent={
          <View style={[styles.accountFooter, { borderTopColor: colors.border }]}>
            {blockedUserNames.length > 0 && (
              <View style={{ gap: 8 }}>
                <View style={styles.gdprTitleRow}>
                  <Feather name="user-x" size={11} color={colors.mutedForeground} />
                  <Text style={[styles.accountFooterTitle, { color: colors.mutedForeground }]}>Blokirani korisnici</Text>
                </View>
                {blockedUserNames.map((name) => (
                  <View key={name} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 }}>
                    <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.foreground }}>@{name}</Text>
                    <Pressable
                      onPress={() => {
                        Alert.alert(
                          "Odblokiraj korisnika",
                          `@${name} će se opet prikazivati u feedu.`,
                          [
                            { text: "Odustani", style: "cancel" },
                            {
                              text: "Odblokiraj",
                              onPress: () => { unblockUser(name); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); },
                            },
                          ]
                        );
                      }}
                      style={({ pressed }) => [{
                        paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8,
                        borderWidth: 1, borderColor: colors.border,
                        backgroundColor: colors.muted,
                        opacity: pressed ? 0.7 : 1,
                      }]}
                    >
                      <Text style={{ fontSize: 11, fontFamily: "Inter_500Medium", color: colors.secondary }}>Odblokiraj</Text>
                    </Pressable>
                  </View>
                ))}
                <View style={[styles.gdprDivider, { width: "100%", height: 1, marginVertical: 4 }]} />
              </View>
            )}
            <View style={styles.gdprTitleRow}>
              <Feather name="shield" size={11} color={colors.mutedForeground} />
              <Text style={[styles.accountFooterTitle, { color: colors.mutedForeground }]}>Privatnost i podaci</Text>
            </View>
            <View style={styles.gdprLinks}>
              <Pressable
                onPress={() => router.push("/terms")}
                style={({ pressed }) => [styles.gdprLink, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Feather name="file-text" size={11} color={colors.secondary} />
                <Text style={[styles.accountFooterText, { color: colors.secondary }]}>Uvjeti korištenja</Text>
              </Pressable>
              <View style={[styles.gdprDivider, { backgroundColor: colors.border }]} />
              <Pressable
                onPress={() => router.push("/privacy")}
                style={({ pressed }) => [styles.gdprLink, { opacity: pressed ? 0.7 : 1 }]}
              >
                <Feather name="lock" size={11} color={colors.secondary} />
                <Text style={[styles.accountFooterText, { color: colors.secondary }]}>Politika privatnosti</Text>
              </Pressable>
            </View>
            {user && (
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
                <Feather name="trash-2" size={11} color={colors.destructive} />
                <Text style={[styles.gdprDeleteText, { color: colors.destructive }]}>
                  Izbriši sve moje podatke (GDPR)
                </Text>
              </Pressable>
            )}
          </View>
        }
      />

      {/* ── Fixed bottom ad banner ──────────────────────────────────────────── */}
      <View style={[styles.fixedAdBottom, { backgroundColor: colors.background, borderTopColor: colors.border, paddingBottom: 4 }]}>
        <AdBannerSlot size="bottom" seed="profile-bottom" />
      </View>

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

      {/* Logout confirmation modal */}
      <Modal visible={showLogoutModal} transparent animationType="fade" onRequestClose={() => setShowLogoutModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowLogoutModal(false)}>
          <Pressable style={[styles.editModal, { backgroundColor: colors.card, borderColor: colors.border, gap: 14 }]} onPress={() => {}}>
            <View style={styles.editModalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Odjava</Text>
              <Pressable onPress={() => setShowLogoutModal(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
              Odjaviš se s profila?
            </Text>
            <View style={styles.modalBtns}>
              <Pressable onPress={() => setShowLogoutModal(false)} style={[styles.modalBtn, { backgroundColor: colors.muted }]}>
                <Text style={[styles.modalBtnText, { color: colors.mutedForeground }]}>Odustani</Text>
              </Pressable>
              <Pressable
                onPress={async () => {
                  setShowLogoutModal(false);
                  await AsyncStorage.multiRemove([BIO_ENABLED_KEY, BIO_ASKED_KEY, BIO_CREDS_KEY]);
                  await logout();
                  router.replace("/(tabs)");
                }}
                style={[styles.modalBtn, { backgroundColor: `${colors.destructive}18`, borderWidth: 1, borderColor: `${colors.destructive}40`, flex: 1 }]}
              >
                <Feather name="log-out" size={14} color={colors.destructive} />
                <Text style={[styles.modalBtnText, { color: colors.destructive }]}>Odjava</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Bio disable confirmation modal */}
      <Modal visible={showBioDisableModal} transparent animationType="fade" onRequestClose={() => setShowBioDisableModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowBioDisableModal(false)}>
          <Pressable style={[styles.editModal, { backgroundColor: colors.card, borderColor: colors.border, gap: 14 }]} onPress={() => {}}>
            <View style={styles.editModalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Deaktiviraj biometriju</Text>
              <Pressable onPress={() => setShowBioDisableModal(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 14, fontFamily: "Inter_400Regular", color: colors.mutedForeground }}>
              Isključuješ prijavu otiskom / licem?
            </Text>
            <View style={styles.modalBtns}>
              <Pressable onPress={() => setShowBioDisableModal(false)} style={[styles.modalBtn, { backgroundColor: colors.muted }]}>
                <Text style={[styles.modalBtnText, { color: colors.mutedForeground }]}>Odustani</Text>
              </Pressable>
              <Pressable
                onPress={confirmBioDisable}
                style={[styles.modalBtn, { backgroundColor: `${colors.destructive}18`, borderWidth: 1, borderColor: `${colors.destructive}40`, flex: 1 }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.destructive }]}>Deaktiviraj</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Biometric enable: password entry modal */}
      <Modal visible={showBioPasswordModal} transparent animationType="fade" onRequestClose={() => setShowBioPasswordModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowBioPasswordModal(false)}>
          <Pressable
            style={[styles.editModal, { backgroundColor: colors.card, borderColor: colors.border, gap: 14 }]}
            onPress={() => {}}
          >
            <View style={styles.editModalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Aktiviraj biometriju</Text>
              <Pressable onPress={() => setShowBioPasswordModal(false)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            <Text style={{ fontSize: 13, fontFamily: "Inter_400Regular", color: colors.mutedForeground, lineHeight: 18 }}>
              Unesi lozinku za potvrdu. Koristit će se samo za biometrijsku prijavu.
            </Text>
            <TextInput
              value={bioPasswordInput}
              onChangeText={setBioPasswordInput}
              placeholder="Lozinka"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.modalInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted }]}
            />
            <View style={styles.modalBtns}>
              <Pressable
                onPress={() => setShowBioPasswordModal(false)}
                style={[styles.modalBtn, { backgroundColor: colors.muted }]}
              >
                <Text style={[styles.modalBtnText, { color: colors.mutedForeground }]}>Odustani</Text>
              </Pressable>
              <Pressable
                onPress={confirmBioEnable}
                disabled={bioActivating || !bioPasswordInput}
                style={[styles.modalBtn, { backgroundColor: colors.primary, flex: 1, opacity: !bioPasswordInput ? 0.5 : 1 }]}
              >
                {bioActivating
                  ? <ActivityIndicator size="small" color={colors.primaryForeground} />
                  : <Text style={[styles.modalBtnText, { color: colors.primaryForeground }]}>Aktiviraj</Text>}
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
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Stanje predmeta</Text>
                <View style={styles.conditionGrid}>
                  {(["Kao novo", "Jako dobro", "Dobro", "Prihvatljivo"] as const).map((cond) => {
                    const COL: Record<string, string> = { "Kao novo": "#38BDF8", "Jako dobro": "#4ADE80", "Dobro": "#FACC15", "Prihvatljivo": "#FB923C" };
                    const col = COL[cond];
                    const selected = editState.condition === cond;
                    return (
                      <Pressable
                        key={cond}
                        onPress={() => setEditState((s) => s ? { ...s, condition: selected ? null : cond } : s)}
                        style={[
                          styles.conditionChip,
                          { backgroundColor: selected ? `${col}22` : colors.muted, borderColor: selected ? col : colors.border },
                        ]}
                      >
                        <View style={[styles.conditionDot, { backgroundColor: col }]} />
                        <Text style={[styles.conditionChipText, { color: selected ? col : colors.mutedForeground }]}>{cond}</Text>
                      </Pressable>
                    );
                  })}
                </View>
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
  cardBody: {
    padding: 14,
    gap: 12,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  typeBadge: {
    paddingHorizontal: 10,
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
  // Dva gumba + "Otvori"
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 2,
  },
  actionBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  dismissBtn: {
    backgroundColor: "#ef4444",
  },
  saveBtn: {
    backgroundColor: "#22c55e",
  },
  actionBtnLabel: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  viewBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  viewBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderTopWidth: 1,
  },
  footerUser: { fontSize: 11, fontFamily: "Inter_400Regular" },
  footerDot: { fontSize: 11 },
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
  fixedAdTop: {
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
  },
  fixedAdBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 6,
    borderTopWidth: 1,
  },
  adBanner: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  adBannerLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    letterSpacing: 0.3,
  },
  headerSection: { paddingHorizontal: 16, gap: 16, paddingBottom: 8 },
  profileCard: { borderRadius: 18, borderWidth: 1, padding: 20, alignItems: "center", gap: 10, position: "relative" },
  inboxBtn: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  inboxBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  inboxBadgeText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#08152E" },
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
  convRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  convAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  convAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  convName: { fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1 },
  convSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  convLastMsg: { fontSize: 12, lineHeight: 17 },
  convTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  convBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  convBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#08152E" },
  list: { paddingHorizontal: 12, paddingTop: 4 },
  listEmpty: { flex: 1 },
  columnWrapper: { gap: 10, paddingHorizontal: 4, marginBottom: 0 },
  cardWrapper: { flex: 1 },
  pendingOverlay: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 14, backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center", justifyContent: "center",
  },
  pendingOverlayText: {
    color: "#F5C100", fontFamily: "Inter_700Bold", fontSize: 13,
    backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 10,
    paddingVertical: 5, borderRadius: 8, overflow: "hidden",
  },
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
  conditionGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  conditionChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  conditionDot: { width: 8, height: 8, borderRadius: 4 },
  conditionChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
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
  accountFooter: { marginTop: 24, borderTopWidth: 1, paddingTop: 16, paddingHorizontal: 12, paddingBottom: 8, gap: 10 },
  accountFooterTitle: { fontSize: 11, fontFamily: "Inter_500Medium", letterSpacing: 0.5, textTransform: "uppercase" },
  accountFooterText: { fontSize: 11, fontFamily: "Inter_400Regular", flex: 1 },
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
