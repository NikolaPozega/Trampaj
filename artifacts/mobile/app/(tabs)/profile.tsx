import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
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
import { EmptyState } from "@/components/EmptyState";
import { ListingCard } from "@/components/ListingCard";
import { CATEGORIES, type Listing, useListings } from "@/context/ListingsContext";
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

const LOCATION_OPTIONS = ["Zagreb", "Split", "Rijeka", "Osijek", "Sarajevo", "Beograd", "Ljubljana", "Ostalo"];

const MATCH_LABEL: Record<TradeMatch["matchType"], string> = {
  both: "Obostrana zamjena ✦",
  i_want: "Ti tražiš ovo",
  they_want: "Oni traže što ti imaš",
};

const MATCH_ICON: Record<TradeMatch["matchType"], keyof typeof Feather.glyphMap> = {
  both: "zap",
  i_want: "arrow-right",
  they_want: "arrow-left",
};

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { listings, myName, setMyName, markAsTraded, markAsActive, deleteListing, updateListing } = useListings();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(myName);
  const [editState, setEditState] = useState<EditState | null>(null);

  const myListings = listings.filter((l) => l.isMine);
  const activeCount = myListings.filter((l) => l.status === "active").length;
  const tradedCount = myListings.filter((l) => l.status === "traded").length;

  const tradeMatches = useMemo(
    () => findTradeMatches(myListings, listings),
    [myListings, listings]
  );

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;

  function handleSaveName() {
    if (nameInput.trim()) {
      setMyName(nameInput.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setEditingName(false);
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

  const inputStyle = [
    styles.modalInput,
    { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.muted },
  ];

  const ListHeader = (
    <View style={[styles.headerSection, { paddingTop: topPad }]}>
      {/* Profile card */}
      <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[styles.avatarRing, { borderColor: colors.secondary }]}>
          <View style={[styles.avatar, { backgroundColor: colors.muted }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {myName.charAt(0).toUpperCase()}
            </Text>
          </View>
        </View>
        <Text style={[styles.name, { color: colors.foreground }]}>{myName}</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Feather key={i} name="star" size={14} color={colors.primary} />
          ))}
          <Text style={[styles.ratingText, { color: colors.mutedForeground }]}>5,0</Text>
        </View>
        <Pressable
          onPress={() => { setNameInput(myName); setEditingName(true); }}
          style={({ pressed }) => [styles.editBtn, { borderColor: colors.border, backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="edit-2" size={13} color={colors.mutedForeground} />
          <Text style={[styles.editBtnText, { color: colors.mutedForeground }]}>Uredi profil</Text>
        </Pressable>
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
            {tradeMatches.length} {tradeMatches.length === 1 ? "podudaranje" : "podudaranja"}
          </Text>
        </View>

        {tradeMatches.length === 0 ? (
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
            {tradeMatches.map((match, idx) => (
              <MatchCard
                key={`${match.myListing.id}-${match.theirListing.id}-${idx}`}
                match={match}
                colors={colors}
              />
            ))}
          </ScrollView>
        )}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Moji oglasi</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <FlatList
        data={myListings}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        ListHeaderComponent={ListHeader}
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
                    style={({ pressed }) => [styles.actionBtn, styles.actionBtnFlex, { backgroundColor: "#2E7D4F", opacity: pressed ? 0.8 : 1 }]}
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

      {/* Name modal */}
      <Modal visible={editingName} transparent animationType="fade" onRequestClose={() => setEditingName(false)}>
        <Pressable style={styles.overlay} onPress={() => setEditingName(false)}>
          <Pressable style={[styles.modal, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
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
              <Pressable onPress={() => setEditingName(false)} style={[styles.modalBtn, { backgroundColor: colors.muted }]}>
                <Text style={[styles.modalBtnText, { color: colors.mutedForeground }]}>Odustani</Text>
              </Pressable>
              <Pressable onPress={handleSaveName} style={[styles.modalBtn, { backgroundColor: colors.primary }]}>
                <Text style={[styles.modalBtnText, { color: colors.primaryForeground }]}>Spremi</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Edit listing modal */}
      <Modal visible={!!editState} transparent animationType="slide" onRequestClose={() => setEditState(null)}>
        <Pressable style={styles.overlay} onPress={() => setEditState(null)}>
          <Pressable style={[styles.editModal, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
            <View style={styles.editModalHeader}>
              <Text style={[styles.modalTitle, { color: colors.foreground }]}>Uredi oglas</Text>
              <Pressable onPress={() => setEditState(null)}>
                <Feather name="x" size={20} color={colors.mutedForeground} />
              </Pressable>
            </View>
            {editState && (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.editModalBody}>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Naslov</Text>
                <TextInput value={editState.title} onChangeText={(v) => setEditState((s) => s ? { ...s, title: v } : s)} style={inputStyle} maxLength={80} />
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Opis</Text>
                <TextInput value={editState.description} onChangeText={(v) => setEditState((s) => s ? { ...s, description: v } : s)} style={[inputStyle, styles.multilineInput]} multiline maxLength={500} textAlignVertical="top" />
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Što želiš zauzvrat</Text>
                <TextInput value={editState.wantedFor} onChangeText={(v) => setEditState((s) => s ? { ...s, wantedFor: v } : s)} style={inputStyle} maxLength={120} />
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Vrijednost u €</Text>
                <TextInput value={editState.priceText} onChangeText={(v) => setEditState((s) => s ? { ...s, priceText: v.replace(/[^0-9.,]/g, "") } : s)} style={inputStyle} keyboardType="decimal-pad" maxLength={10} placeholder="Opcionalno" placeholderTextColor={colors.mutedForeground} />
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Kategorija</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                  {CATEGORIES.filter((c) => c !== "Sve").map((cat) => (
                    <Pressable key={cat} onPress={() => setEditState((s) => s ? { ...s, category: cat } : s)}
                      style={[styles.chip, { backgroundColor: editState.category === cat ? colors.primary : colors.muted, borderColor: editState.category === cat ? colors.primary : colors.border }]}>
                      <Text style={[styles.chipText, { color: editState.category === cat ? colors.primaryForeground : colors.mutedForeground }]}>{cat}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Lokacija</Text>
                <View style={styles.locationGrid}>
                  {LOCATION_OPTIONS.map((loc) => (
                    <Pressable key={loc} onPress={() => setEditState((s) => s ? { ...s, location: loc } : s)}
                      style={[styles.chip, { backgroundColor: editState.location === loc ? colors.primary : colors.muted, borderColor: editState.location === loc ? colors.primary : colors.border }]}>
                      <Text style={[styles.chipText, { color: editState.location === loc ? colors.primaryForeground : colors.mutedForeground }]}>{loc}</Text>
                    </Pressable>
                  ))}
                </View>
                <View style={styles.modalBtns}>
                  <Pressable onPress={() => setEditState(null)} style={[styles.modalBtn, { backgroundColor: colors.muted }]}>
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

// ─── Match Card ────────────────────────────────────────────────────────────────

function MatchCard({ match, colors }: { match: TradeMatch; colors: ReturnType<typeof import("@/hooks/useColors").useColors> }) {
  const isBoth = match.matchType === "both";
  const badgeColor = isBoth ? colors.primary : colors.secondary;
  const badgeBg = isBoth ? `${colors.primary}20` : `${colors.secondary}20`;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push(`/listing/${match.theirListing.id}`);
      }}
      style={({ pressed }) => [
        mcStyles.card,
        { backgroundColor: colors.card, borderColor: isBoth ? colors.primary : colors.border, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      {/* Match type badge */}
      <View style={[mcStyles.typeBadge, { backgroundColor: badgeBg, borderColor: badgeColor }]}>
        <Feather name={MATCH_ICON[match.matchType]} size={11} color={badgeColor} />
        <Text style={[mcStyles.typeBadgeText, { color: badgeColor }]}>
          {MATCH_LABEL[match.matchType]}
        </Text>
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

        <View style={[mcStyles.arrowCircle, { backgroundColor: isBoth ? colors.primary : colors.muted, borderColor: isBoth ? colors.primary : colors.border }]}>
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

      {/* Footer */}
      <View style={[mcStyles.footer, { borderTopColor: colors.border }]}>
        <View style={mcStyles.footerLeft}>
          <Feather name="user" size={11} color={colors.mutedForeground} />
          <Text style={[mcStyles.footerUser, { color: colors.mutedForeground }]}>
            {match.theirListing.userName}
          </Text>
          <Text style={[mcStyles.footerDot, { color: colors.mutedForeground }]}>·</Text>
          <Feather name="map-pin" size={11} color={colors.mutedForeground} />
          <Text style={[mcStyles.footerUser, { color: colors.mutedForeground }]}>
            {match.theirListing.location}
          </Text>
        </View>
        <View style={[mcStyles.viewBtn, { backgroundColor: colors.primary }]}>
          <Text style={[mcStyles.viewBtnText, { color: colors.primaryForeground }]}>Otvori</Text>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Stat Pill ─────────────────────────────────────────────────────────────────

function StatPill({ label, value, color, textColor, bg }: { label: string; value: number; color: string; textColor: string; bg: string }) {
  return (
    <View style={[statStyles.pill, { backgroundColor: bg }]}>
      <Text style={[statStyles.value, { color }]}>{value}</Text>
      <Text style={[statStyles.label, { color: textColor }]}>{label}</Text>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const mcStyles = StyleSheet.create({
  card: {
    width: 300,
    borderRadius: 16,
    borderWidth: 1.5,
    padding: 14,
    gap: 12,
  },
  typeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  typeBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  exchangeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  itemBox: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
    gap: 3,
    minHeight: 80,
    justifyContent: "center",
  },
  itemLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", letterSpacing: 0.3 },
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
  },
  footerLeft: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1 },
  footerUser: { fontSize: 11, fontFamily: "Inter_400Regular" },
  footerDot: { fontSize: 11 },
  viewBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  viewBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
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
  avatarRing: { width: 82, height: 82, borderRadius: 41, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  avatar: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 28, fontFamily: "Inter_700Bold" },
  name: { fontSize: 20, fontFamily: "Inter_700Bold" },
  starsRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 13, fontFamily: "Inter_400Regular", marginLeft: 4 },
  editBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  editBtnText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  divider: { width: "100%", height: 1, marginVertical: 4 },
  stats: { flexDirection: "row", gap: 8, width: "100%" },
  suggestSection: { gap: 10 },
  suggestTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  suggestTitleBadge: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  suggestTitleText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  suggestCount: { fontSize: 12, fontFamily: "Inter_400Regular" },
  suggestScroll: { gap: 10, paddingRight: 16 },
  suggestEmpty: { borderRadius: 16, borderWidth: 1, padding: 24, alignItems: "center", gap: 8 },
  suggestEmptyTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  suggestEmptySub: { fontSize: 12, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 18 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", paddingTop: 4 },
  list: { paddingHorizontal: 12, paddingTop: 4 },
  listEmpty: { flex: 1 },
  columnWrapper: { gap: 10, paddingHorizontal: 4, marginBottom: 0 },
  cardWrapper: { flex: 1 },
  actions: { flexDirection: "row", gap: 5, marginTop: -8, marginBottom: 12, paddingHorizontal: 2 },
  actionBtn: { alignItems: "center", justifyContent: "center", paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8 },
  actionBtnFlex: { flex: 1, flexDirection: "row", gap: 4 },
  actionBtnText: { color: "#fff", fontSize: 11, fontFamily: "Inter_500Medium" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", alignItems: "center", justifyContent: "center", padding: 24 },
  modal: { width: "100%", borderRadius: 16, borderWidth: 1, padding: 20, gap: 14 },
  editModal: { width: "100%", borderRadius: 20, borderWidth: 1, padding: 20, maxHeight: "88%" },
  editModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  editModalBody: { gap: 10, paddingBottom: 8 },
  modalTitle: { fontSize: 17, fontFamily: "Inter_600SemiBold" },
  modalInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11, fontSize: 15, fontFamily: "Inter_400Regular" },
  multilineInput: { minHeight: 80, textAlignVertical: "top", paddingTop: 11 },
  fieldLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.4, textTransform: "uppercase" },
  chips: { gap: 8, paddingRight: 4 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  locationGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  modalBtns: { flexDirection: "row", gap: 10, marginTop: 4 },
  modalBtn: { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 10 },
  modalBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
