import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  Dimensions,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChat } from "@/context/ChatContext";
import { useListings, type Listing } from "@/context/ListingsContext";
import { useColors } from "@/hooks/useColors";

// ─── Matching helpers ─────────────────────────────────────────────────────────

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function tokenize(text: string): string[] {
  return normalize(text).split(/[\s,.!?;:()\-\/\\]+/).filter((w) => w.length >= 3);
}
function wordsSimilar(a: string, b: string): boolean {
  if (a === b) return true;
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  if (short.length / long.length < 0.72) return false;
  const pl = short.length - 1;
  return pl >= 2 && a.substring(0, pl) === b.substring(0, pl);
}
function overlap(tokensA: string[], tokensB: string[]): number {
  return tokensA.reduce(
    (sum, a) => sum + (tokensB.some((b) => wordsSimilar(a, b)) ? 1 : 0),
    0
  );
}

type MatchType = "both" | "i_want" | "they_want";
type MatchResult = { listing: Listing; matchType: MatchType };

const MATCH_LABEL: Record<MatchType, string> = {
  both: "Obostrana zamjena ✦",
  i_want: "Ti tražiš ovo",
  they_want: "Oni traže što ti imaš",
};

function computeMatches(listing: Listing, all: Listing[]): MatchResult[] {
  const nudimTokens = [
    ...tokenize(listing.title),
    ...tokenize(listing.description ?? ""),
    ...(listing.nudimTags ?? []).flatMap(tokenize),
  ];
  const trazimTokens = [
    ...tokenize(listing.wantedFor),
    ...(listing.trazimTags ?? []).flatMap(tokenize),
  ];

  return all
    .filter((l) => l.id !== listing.id && l.status === "active" && !l.isMine)
    .map((l) => {
      const theirNudim = [
        ...tokenize(l.title),
        ...tokenize(l.description ?? ""),
        ...(l.nudimTags ?? []).flatMap(tokenize),
      ];
      const theirTrazim = [
        ...tokenize(l.wantedFor),
        ...(l.trazimTags ?? []).flatMap(tokenize),
      ];
      const theyWantMine = overlap(nudimTokens, theirTrazim);
      const iWantTheirs = overlap(trazimTokens, theirNudim);
      const matchType: MatchType =
        theyWantMine > 0 && iWantTheirs > 0
          ? "both"
          : theyWantMine > 0
          ? "they_want"
          : "i_want";
      return { l, score: theyWantMine * 2 + iWantTheirs * 2, theyWantMine, iWantTheirs, matchType };
    })
    .filter(({ theyWantMine, iWantTheirs }) => theyWantMine > 0 || iWantTheirs > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(({ l, matchType }) => ({ listing: l, matchType }));
}

// ─── Match section component ──────────────────────────────────────────────────

function MatchSection({
  listing,
  all,
  colors,
}: {
  listing: Listing;
  all: Listing[];
  colors: ReturnType<typeof useColors>;
}) {
  const matches = React.useMemo(() => computeMatches(listing, all), [listing, all]);
  if (matches.length === 0) return null;

  return (
    <View style={mStyles.container}>
      <View style={mStyles.header}>
        <Feather name="zap" size={14} color={colors.primary} />
        <Text style={[mStyles.headerText, { color: colors.primary }]}>
          Podudaranja za ovaj oglas
        </Text>
        <View style={[mStyles.badge, { backgroundColor: colors.primary + "22" }]}>
          <Text style={[mStyles.badgeText, { color: colors.primary }]}>{matches.length}</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={mStyles.scroll}>
        {matches.map(({ listing: item, matchType }) => {
          const imgs = (item.imageUris?.length ?? 0) > 0 ? item.imageUris : item.imageUri ? [item.imageUri] : [];
          const isBoth = matchType === "both";
          const badgeColor = isBoth ? colors.primary : colors.secondary;
          const badgeBg = isBoth ? colors.primary + "22" : colors.secondary + "22";
          return (
            <Pressable
              key={item.id}
              onPress={() => router.push(`/listing/${item.id}`)}
              style={({ pressed }) => [
                mStyles.card,
                { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              {imgs[0] ? (
                <Image source={{ uri: imgs[0] }} style={mStyles.cardImg} contentFit="cover" />
              ) : (
                <View style={[mStyles.cardImgPlaceholder, { backgroundColor: colors.muted }]}>
                  <Feather name="package" size={22} color={colors.mutedForeground} />
                </View>
              )}
              <View style={[mStyles.typeBadge, { backgroundColor: badgeBg, borderColor: badgeColor }]}>
                <Text style={[mStyles.typeBadgeText, { color: badgeColor }]}>
                  {MATCH_LABEL[matchType]}
                </Text>
              </View>
              <View style={mStyles.cardBody}>
                <Text style={[mStyles.cardTitle, { color: colors.foreground }]} numberOfLines={2}>
                  {item.title}
                </Text>
                <Text style={[mStyles.cardWanted, { color: colors.mutedForeground }]} numberOfLines={1}>
                  ↔ {item.wantedFor}
                </Text>
                {item.price != null && (
                  <Text style={[mStyles.cardPrice, { color: colors.mutedForeground }]}>
                    {item.price} €
                  </Text>
                )}
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const mStyles = StyleSheet.create({
  container: { gap: 10 },
  header: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerText: { fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  scroll: { gap: 10, paddingRight: 4 },
  card: { width: 150, borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  cardImg: { width: "100%", height: 100 },
  cardImgPlaceholder: { width: "100%", height: 100, alignItems: "center", justifyContent: "center" },
  typeBadge: {
    marginHorizontal: 8,
    marginTop: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  typeBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  cardBody: { padding: 8, paddingTop: 6, gap: 3 },
  cardTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", lineHeight: 16 },
  cardWanted: { fontSize: 11, fontFamily: "Inter_400Regular" },
  cardPrice: { fontSize: 11, fontFamily: "Inter_500Medium" },
});

// ─────────────────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  Elektronika: "cpu",
  Odjeća: "shopping-bag",
  Knjige: "book",
  Sport: "activity",
  Nakit: "star",
  Namještaj: "home",
  Igračke: "gift",
  Ostalo: "package",
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "danas";
  if (days === 1) return "jučer";
  return `prije ${days} dana`;
}

function StarRow({ value, onChange, size = 28 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} onPress={() => onChange?.(i)} disabled={!onChange} hitSlop={6}>
          <Feather name="star" size={size} color={i <= value ? "#F5C100" : "#334155"} />
        </Pressable>
      ))}
    </View>
  );
}

type ModalMode = "barter" | "buy" | "review";

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { listings, myName, reviews, addReview } = useListings();
  const [imgIdx, setImgIdx] = useState(0);
  const [heroWidth, setHeroWidth] = useState(0);
  const [offerModal, setOfferModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("barter");
  const [offerText, setOfferText] = useState("");
  const [offerSent, setOfferSent] = useState(false);
  const [reviewStars, setReviewStars] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSent, setReviewSent] = useState(false);
  const { getOrCreateConversation } = useChat();

  const listing = listings.find((l) => l.id === id);
  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 16);

  if (!listing) {
    return (
      <View style={[styles.notFound, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>Oglas nije pronađen</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backLink, { color: colors.primary }]}>Natrag</Text>
        </Pressable>
      </View>
    );
  }

  const iconName = CATEGORY_ICONS[listing.category] ?? "package";
  const hasPrice = listing.price != null && listing.price > 0;
  const sellerReviews = reviews.filter((r) => r.targetUserName === listing.userName);
  const avgStars = sellerReviews.length
    ? sellerReviews.reduce((s, r) => s + r.stars, 0) / sellerReviews.length
    : 5;
  const alreadyReviewed = sellerReviews.some((r) => r.authorName === myName);

  function openModal(mode: ModalMode) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalMode(mode);
    setReviewStars(5);
    setReviewComment("");
    setReviewSent(false);
    setOfferSent(false);
    setOfferText("");
    setOfferModal(true);
  }

  function handleSend() {
    if (modalMode === "review") {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      addReview(listing.userName, reviewStars, reviewComment);
      setReviewSent(true);
      setTimeout(() => setOfferModal(false), 1600);
      return;
    }
    if (modalMode === "barter" && !offerText.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setOfferSent(true);
    setTimeout(() => { setOfferModal(false); setOfferText(""); setOfferSent(false); }, 1500);
  }

  function handleCall() {
    if (listing.phone) {
      Linking.openURL(`tel:${listing.phone.replace(/\s/g, "")}`);
    }
  }

  function goToUser() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/user/${encodeURIComponent(listing.userName)}`);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backCircle, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.topBarTitle, { color: colors.foreground }]} numberOfLines={1}>
          {listing.category}
        </Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 120 }]} showsVerticalScrollIndicator={false}>
        {(() => {
          const images = (listing.imageUris?.length ?? 0) > 0
            ? listing.imageUris!
            : listing.imageUri ? [listing.imageUri] : [];
          return (
            <View
              style={[styles.imageHero, { backgroundColor: colors.card, borderColor: colors.border }]}
              onLayout={(e) => setHeroWidth(e.nativeEvent.layout.width)}
            >
              {images.length > 0 && heroWidth > 0 ? (
                <>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    style={{ width: heroWidth, height: "100%" }}
                    onMomentumScrollEnd={(e) =>
                      setImgIdx(Math.round(e.nativeEvent.contentOffset.x / heroWidth))
                    }
                  >
                    {images.map((uri, i) => (
                      <Image
                        key={i}
                        source={{ uri }}
                        style={{ width: heroWidth, height: "100%" }}
                        contentFit="cover"
                      />
                    ))}
                  </ScrollView>
                  {images.length > 1 && (
                    <View style={styles.dotsRow}>
                      {images.map((_, i) => (
                        <View
                          key={i}
                          style={[
                            styles.dot,
                            { backgroundColor: i === imgIdx ? colors.primary : "rgba(255,255,255,0.4)" },
                          ]}
                        />
                      ))}
                    </View>
                  )}
                  {images.length > 1 && (
                    <View style={[styles.imageCountPill, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
                      <Text style={styles.imageCountPillText}>{imgIdx + 1}/{images.length}</Text>
                    </View>
                  )}
                </>
              ) : images.length > 0 && heroWidth === 0 ? null : (
                <Feather name={iconName} size={64} color={colors.secondary} />
              )}
              {listing.status === "traded" && (
                <View style={styles.tradedOverlay}>
                  <Text style={styles.tradedOverlayText}>Zamijenjeno</Text>
                </View>
              )}
            </View>
          );
        })()}

        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={3}>
            {listing.title}
          </Text>
          {hasPrice && (
            <Text style={[styles.priceLabel, { color: colors.primary }]}>
              {listing.price} €
            </Text>
          )}
        </View>

        <View style={styles.tradeRow}>
          <Feather name="refresh-cw" size={14} color={colors.primary} />
          <Text style={[styles.tradeText, { color: colors.primary }]}>
            Tražim za zamjenu: {listing.wantedFor}
          </Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Opis</Text>
          <Text style={[styles.sectionText, { color: colors.foreground }]}>{listing.description}</Text>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        {/* Clickable user row */}
        <Pressable
          onPress={goToUser}
          style={({ pressed }) => [styles.userRow, { opacity: pressed ? 0.75 : 1 }]}
        >
          <View style={[styles.userAvatar, { backgroundColor: colors.muted, borderColor: colors.secondary }]}>
            <Text style={[styles.userAvatarText, { color: colors.primary }]}>
              {listing.userName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <View style={styles.userNameRow}>
              <Text style={[styles.userName, { color: colors.secondary }]}>{listing.userName}</Text>
              <Feather name="check-circle" size={14} color={colors.secondary} />
              <Feather name="chevron-right" size={13} color={colors.mutedForeground} style={{ marginLeft: "auto" }} />
            </View>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Feather key={i} name="star" size={11} color={i <= Math.round(avgStars) ? colors.primary : colors.border} />
              ))}
              <Text style={[styles.reviewCount, { color: colors.mutedForeground }]}>
                {sellerReviews.length > 0 ? `${avgStars.toFixed(1)} (${sellerReviews.length})` : "Bez ocjena"}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Reviews list */}
        {sellerReviews.length > 0 && (
          <View style={styles.reviewsList}>
            {sellerReviews.slice(0, 3).map((r) => (
              <View key={r.id} style={[styles.reviewItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.reviewHeader}>
                  <Text style={[styles.reviewAuthor, { color: colors.foreground }]}>{r.authorName}</Text>
                  <View style={{ flexDirection: "row", gap: 2 }}>
                    {[1, 2, 3, 4, 5].map((i) => (
                      <Feather key={i} name="star" size={10} color={i <= r.stars ? "#F5C100" : colors.border} />
                    ))}
                  </View>
                </View>
                {r.comment.length > 0 && (
                  <Text style={[styles.reviewComment, { color: colors.mutedForeground }]} numberOfLines={3}>
                    {r.comment}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        <View style={styles.metaList}>
          <View style={styles.metaItem}>
            <Feather name="map-pin" size={14} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.foreground }]}>{listing.location}</Text>
          </View>
          {listing.phone && (
            <Pressable style={styles.metaItem} onPress={handleCall}>
              <Feather name="phone" size={14} color={colors.mutedForeground} />
              <Text style={[styles.metaText, { color: colors.secondary }]}>{listing.phone}</Text>
            </Pressable>
          )}
          <View style={styles.metaItem}>
            <Feather name="clock" size={14} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{timeAgo(listing.createdAt)}</Text>
          </View>
        </View>

        <View style={[styles.divider, { backgroundColor: colors.border }]} />

        <MatchSection listing={listing} all={listings} colors={colors} />
      </ScrollView>

      {!listing.isMine && listing.status === "active" && (
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: bottomPad + 8 }]}>
          <View style={styles.footerButtons}>
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                getOrCreateConversation(listing.id, listing.title, listing.userName);
                router.push(`/chat/${listing.id}?listingTitle=${encodeURIComponent(listing.title)}&otherUser=${encodeURIComponent(listing.userName)}`);
              }}
              style={({ pressed }) => [
                styles.footerBtn,
                { borderColor: colors.primary, borderWidth: 1.5, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Feather name="message-square" size={16} color={colors.primary} />
              <Text style={[styles.footerBtnText, { color: colors.primary }]}>Pošalji poruku</Text>
            </Pressable>

            {listing.phone ? (
              <Pressable
                onPress={handleCall}
                style={({ pressed }) => [
                  styles.footerBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Feather name="phone" size={16} color={colors.primaryForeground} />
                <Text style={[styles.footerBtnText, { color: colors.primaryForeground }]}>Nazovi</Text>
              </Pressable>
            ) : hasPrice ? (
              <Pressable
                onPress={() => openModal("buy")}
                style={({ pressed }) => [
                  styles.footerBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Feather name="tag" size={16} color={colors.primaryForeground} />
                <Text style={[styles.footerBtnText, { color: colors.primaryForeground }]}>
                  Kupi · {listing.price} €
                </Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.footerMeta}>
            {!alreadyReviewed && (
              <Pressable
                onPress={() => openModal("review")}
                style={({ pressed }) => [styles.reviewBtn, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
              >
                <Feather name="star" size={13} color={colors.primary} />
                <Text style={[styles.reviewBtnText, { color: colors.primary }]}>Ocijeni prodavatelja</Text>
              </Pressable>
            )}
            <Pressable style={styles.reportBtn}>
              <Text style={[styles.reportText, { color: colors.mutedForeground }]}>Prijavi oglas</Text>
            </Pressable>
          </View>
        </View>
      )}

      <Modal visible={offerModal} transparent animationType="slide" onRequestClose={() => setOfferModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setOfferModal(false)}>
          <Pressable style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
            {(offerSent || reviewSent) ? (
              <View style={styles.sentContainer}>
                <View style={[styles.sentIcon, { backgroundColor: "#2E7D4F" }]}>
                  <Feather name="check" size={28} color="#fff" />
                </View>
                <Text style={[styles.sentTitle, { color: colors.foreground }]}>
                  {reviewSent ? "Ocjena poslana!" : modalMode === "buy" ? "Zahtjev poslan!" : "Poruka poslana!"}
                </Text>
                <Text style={[styles.sentSub, { color: colors.mutedForeground }]}>
                  {reviewSent ? `Hvala na ocjeni za ${listing.userName}` : `${listing.userName} će te kontaktirati uskoro`}
                </Text>
              </View>
            ) : modalMode === "review" ? (
              <>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Ocijeni prodavatelja</Text>
                <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
                  {listing.userName} · {listing.title}
                </Text>
                <View style={{ alignItems: "center", paddingVertical: 8 }}>
                  <StarRow value={reviewStars} onChange={setReviewStars} size={36} />
                </View>
                <TextInput
                  value={reviewComment}
                  onChangeText={setReviewComment}
                  placeholder="Napiši komentar (opcionalno)..."
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.modalInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted }]}
                  multiline
                  maxLength={400}
                  textAlignVertical="top"
                />
                <Pressable
                  onPress={handleSend}
                  style={({ pressed }) => [
                    styles.modalBtn,
                    { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Text style={[styles.modalBtnText, { color: colors.primaryForeground }]}>Pošalji ocjenu</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>
                  {modalMode === "buy" ? "Kupnja" : "Pošalji poruku"}
                </Text>
                <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
                  Za oglas: {listing.title}
                </Text>
                {modalMode === "buy" && hasPrice && (
                  <View style={[styles.buyBox, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                    <Text style={[styles.buyBoxLabel, { color: colors.mutedForeground }]}>Iznos</Text>
                    <Text style={[styles.buyBoxAmount, { color: colors.primary }]}>
                      {listing.price} €
                    </Text>
                  </View>
                )}
                <TextInput
                  value={offerText}
                  onChangeText={setOfferText}
                  placeholder={modalMode === "buy" ? "Dodaj poruku (opcionalno)..." : "Što nudiš u zamjenu? Opiši..."}
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.modalInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted }]}
                  multiline
                  maxLength={300}
                  textAlignVertical="top"
                />
                <Pressable
                  onPress={handleSend}
                  disabled={modalMode === "barter" && !offerText.trim()}
                  style={({ pressed }) => [
                    styles.modalBtn,
                    {
                      backgroundColor: (modalMode === "barter" && !offerText.trim()) ? colors.muted : colors.primary,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.modalBtnText, { color: (modalMode === "barter" && !offerText.trim()) ? colors.mutedForeground : colors.primaryForeground }]}>
                    {modalMode === "buy" ? "Pošalji zahtjev" : "Pošalji ponudu"}
                  </Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  notFound: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  notFoundText: { fontSize: 16, fontFamily: "Inter_400Regular" },
  backLink: { fontSize: 15, fontFamily: "Inter_500Medium" },
  topBar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, justifyContent: "space-between", borderBottomWidth: 1 },
  backCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  topBarTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  content: { padding: 16, gap: 16 },
  imageHero: { height: 260, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  dotsRow: { position: "absolute", bottom: 10, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  imageCountPill: { position: "absolute", top: 10, right: 10, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  imageCountPillText: { color: "#fff", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  heroPrice: { position: "absolute", bottom: 12, right: 12, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  heroPriceText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  tradedOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center" },
  tradedOverlayText: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 10 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", flex: 1, lineHeight: 28 },
  priceLabel: { fontSize: 22, fontFamily: "Inter_700Bold", flexShrink: 0 },
  tradeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tradeText: { fontSize: 14, fontFamily: "Inter_500Medium", flex: 1 },
  divider: { height: 1 },
  section: { gap: 6 },
  sectionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sectionText: { fontSize: 15, fontFamily: "Inter_400Regular", lineHeight: 22 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  userAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  userAvatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  userInfo: { flex: 1, gap: 4 },
  userNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  userName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  starsRow: { flexDirection: "row", gap: 2, alignItems: "center" },
  reviewCount: { fontSize: 11, fontFamily: "Inter_400Regular", marginLeft: 4 },
  reviewsList: { gap: 8 },
  reviewItem: { borderRadius: 12, borderWidth: 1, padding: 12, gap: 6 },
  reviewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reviewAuthor: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  reviewComment: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  metaList: { gap: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 10 },
  metaText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  footer: { padding: 16, borderTopWidth: 1, gap: 10 },
  footerButtons: { flexDirection: "row", gap: 10 },
  footerBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 14, paddingVertical: 14 },
  footerBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  footerMeta: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reviewBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, borderWidth: 1 },
  reviewBtnText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  reportBtn: { paddingVertical: 2 },
  reportText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modal: { borderTopLeftRadius: 24, borderTopRightRadius: 24, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, padding: 20, gap: 14, paddingBottom: 40 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  modalSub: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: -6 },
  buyBox: { borderRadius: 12, borderWidth: 1, padding: 14, gap: 4 },
  buyBoxLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  buyBoxAmount: { fontSize: 22, fontFamily: "Inter_700Bold" },
  modalInput: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular", height: 90, paddingTop: 12 },
  modalBtn: { alignItems: "center", paddingVertical: 14, borderRadius: 12 },
  modalBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  sentContainer: { alignItems: "center", paddingVertical: 20, gap: 12 },
  sentIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  sentTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  sentSub: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
});
