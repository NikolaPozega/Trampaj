import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
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
import { useListings } from "@/context/ListingsContext";
import { useColors } from "@/hooks/useColors";

const CATEGORY_ICONS: Record<string, string> = {
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
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `prije ${mins} minuta`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `prije ${hrs} sati`;
  const days = Math.floor(hrs / 24);
  return `prije ${days} dana`;
}

type ModalMode = "barter" | "buy";

export default function ListingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { listings } = useListings();
  const [offerModal, setOfferModal] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>("barter");
  const [offerText, setOfferText] = useState("");
  const [offerSent, setOfferSent] = useState(false);

  const listing = listings.find((l) => l.id === id);

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 34 : 16);

  if (!listing) {
    return (
      <View style={[styles.notFound, { backgroundColor: colors.background }]}>
        <Text style={[styles.notFoundText, { color: colors.mutedForeground }]}>Oglas nije pronađen</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backBtnText, { color: colors.primary }]}>Natrag</Text>
        </Pressable>
      </View>
    );
  }

  const iconName = (CATEGORY_ICONS[listing.category] ?? "package") as keyof typeof Feather.glyphMap;
  const hasPrice = listing.price != null && listing.price > 0;

  function openModal(mode: ModalMode) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setModalMode(mode);
    setOfferModal(true);
  }

  function handleSend() {
    if (modalMode === "barter" && !offerText.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setOfferSent(true);
    setTimeout(() => {
      setOfferModal(false);
      setOfferText("");
      setOfferSent(false);
    }, 1500);
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: topPad + 8, backgroundColor: colors.background, borderBottomColor: colors.border }]}>
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

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: bottomPad + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.iconHero, { backgroundColor: colors.accent }]}>
          <Feather name={iconName} size={52} color={colors.primary} />
          {hasPrice && (
            <View style={styles.priceBadgeHero}>
              <Text style={styles.priceBadgeText}>
                {listing.price} {listing.currency}
              </Text>
            </View>
          )}
        </View>

        {listing.status === "traded" && (
          <View style={[styles.tradedBanner, { backgroundColor: colors.secondary }]}>
            <Feather name="check-circle" size={16} color="#fff" />
            <Text style={styles.tradedBannerText}>Ovaj predmet je već zamijenjen</Text>
          </View>
        )}

        <Text style={[styles.title, { color: colors.foreground }]}>{listing.title}</Text>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Feather name="user" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{listing.userName}</Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="map-pin" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{listing.location}</Text>
          </View>
          <View style={styles.metaItem}>
            <Feather name="clock" size={13} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{timeAgo(listing.createdAt)}</Text>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>OPIS</Text>
          <Text style={[styles.sectionText, { color: colors.foreground }]}>{listing.description}</Text>
        </View>

        <View style={[styles.wantsSection, { backgroundColor: colors.accent, borderColor: colors.primary + "33" }]}>
          <View style={styles.wantsHeader}>
            <Feather name="refresh-cw" size={14} color={colors.primary} />
            <Text style={[styles.wantsLabel, { color: colors.primary }]}>Traži u zamjenu</Text>
          </View>
          <Text style={[styles.wantsText, { color: colors.foreground }]}>{listing.wantedFor}</Text>
        </View>

        {hasPrice && (
          <View style={[styles.priceSection, { backgroundColor: "#E8F5EC", borderColor: "#A8D5B5" }]}>
            <View style={styles.wantsHeader}>
              <Feather name="tag" size={14} color="#2E7D4F" />
              <Text style={[styles.wantsLabel, { color: "#2E7D4F" }]}>Ili kupi direktno</Text>
            </View>
            <Text style={styles.priceAmount}>
              {listing.price} {listing.currency}
            </Text>
          </View>
        )}
      </ScrollView>

      {!listing.isMine && listing.status === "active" && (
        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: bottomPad + 8 }]}>
          {hasPrice ? (
            <View style={styles.footerButtons}>
              <Pressable
                onPress={() => openModal("barter")}
                style={({ pressed }) => [styles.footerBtn, styles.footerBtnOutline, { borderColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
              >
                <Feather name="refresh-cw" size={16} color={colors.primary} />
                <Text style={[styles.footerBtnText, { color: colors.primary }]}>Trampa</Text>
              </Pressable>
              <Pressable
                onPress={() => openModal("buy")}
                style={({ pressed }) => [styles.footerBtn, styles.footerBtnFill, { backgroundColor: "#2E7D4F", opacity: pressed ? 0.85 : 1 }]}
              >
                <Feather name="tag" size={16} color="#fff" />
                <Text style={[styles.footerBtnText, { color: "#fff" }]}>
                  Kupi · {listing.price} {listing.currency}
                </Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => openModal("barter")}
              style={({ pressed }) => [styles.offerBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.88 : 1, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
            >
              <Feather name="refresh-cw" size={18} color="#fff" />
              <Text style={styles.offerBtnText}>Ponudi zamjenu</Text>
            </Pressable>
          )}
        </View>
      )}

      <Modal visible={offerModal} transparent animationType="slide" onRequestClose={() => setOfferModal(false)}>
        <Pressable style={styles.overlay} onPress={() => setOfferModal(false)}>
          <Pressable
            style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => {}}
          >
            {offerSent ? (
              <View style={styles.sentContainer}>
                <View style={[styles.sentIcon, { backgroundColor: modalMode === "buy" ? "#2E7D4F" : colors.secondary }]}>
                  <Feather name="check" size={28} color="#fff" />
                </View>
                <Text style={[styles.sentTitle, { color: colors.foreground }]}>
                  {modalMode === "buy" ? "Zahtjev poslan!" : "Ponuda poslana!"}
                </Text>
                <Text style={[styles.sentSub, { color: colors.mutedForeground }]}>
                  {listing.userName} će primiti tvoj {modalMode === "buy" ? "zahtjev za kupnju" : "prijedlog zamjene"}
                </Text>
              </View>
            ) : modalMode === "buy" ? (
              <>
                <View style={styles.modalTitleRow}>
                  <Feather name="tag" size={18} color="#2E7D4F" />
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>Kupnja</Text>
                </View>
                <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
                  Šalješ zahtjev za: {listing.title}
                </Text>
                <View style={[styles.buyAmountBox, { backgroundColor: "#E8F5EC", borderColor: "#A8D5B5" }]}>
                  <Text style={styles.buyAmountLabel}>Iznos koji plaćaš</Text>
                  <Text style={styles.buyAmount}>
                    {listing.price} {listing.currency}
                  </Text>
                </View>
                <Pressable
                  onPress={handleSend}
                  style={({ pressed }) => [styles.modalBtn, { backgroundColor: "#2E7D4F", opacity: pressed ? 0.8 : 1 }]}
                >
                  <Text style={[styles.modalBtnText, { color: "#fff" }]}>Pošalji zahtjev za kupnju</Text>
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.modalTitleRow}>
                  <Feather name="refresh-cw" size={18} color={colors.primary} />
                  <Text style={[styles.modalTitle, { color: colors.foreground }]}>Ponudi zamjenu</Text>
                </View>
                <Text style={[styles.modalSub, { color: colors.mutedForeground }]}>
                  Šalješ ponudu za: {listing.title}
                </Text>
                <TextInput
                  value={offerText}
                  onChangeText={setOfferText}
                  placeholder="Što nudiš u zamjenu? Opiši predmet..."
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.modalInput, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
                  multiline
                  maxLength={300}
                  textAlignVertical="top"
                />
                <Pressable
                  onPress={handleSend}
                  disabled={!offerText.trim()}
                  style={({ pressed }) => [
                    styles.modalBtn,
                    { backgroundColor: offerText.trim() ? colors.primary : colors.muted, opacity: pressed ? 0.8 : 1 },
                  ]}
                >
                  <Text style={[styles.modalBtnText, { color: offerText.trim() ? "#fff" : colors.mutedForeground }]}>
                    Pošalji ponudu
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
  backBtn: { padding: 8 },
  backBtnText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  backCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  topBarTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  content: { padding: 16, gap: 14 },
  iconHero: {
    height: 160,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  priceBadgeHero: {
    position: "absolute",
    bottom: 12,
    right: 12,
    backgroundColor: "#2E7D4F",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  priceBadgeText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  tradedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
  },
  tradedBannerText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  title: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.8,
  },
  sectionText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    lineHeight: 22,
  },
  wantsSection: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  priceSection: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    gap: 6,
  },
  wantsHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  wantsLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
  wantsText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    lineHeight: 22,
  },
  priceAmount: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#2E7D4F",
  },
  footer: {
    padding: 16,
    borderTopWidth: 1,
  },
  footerButtons: {
    flexDirection: "row",
    gap: 10,
  },
  footerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 14,
    paddingVertical: 14,
  },
  footerBtnOutline: {
    borderWidth: 1.5,
  },
  footerBtnFill: {},
  footerBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  offerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 15,
  },
  offerBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modal: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    padding: 20,
    gap: 14,
    paddingBottom: 40,
  },
  modalTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  modalSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    marginTop: -6,
  },
  buyAmountBox: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 4,
  },
  buyAmountLabel: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#2E7D4F",
    letterSpacing: 0.5,
  },
  buyAmount: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#2E7D4F",
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    height: 100,
    paddingTop: 12,
  },
  modalBtn: {
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 12,
  },
  modalBtnText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  sentContainer: {
    alignItems: "center",
    paddingVertical: 20,
    gap: 12,
  },
  sentIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  sentTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  sentSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
});
