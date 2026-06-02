import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard } from "@/components/ListingCard";
import { useListings } from "@/context/ListingsContext";
import { useColors } from "@/hooks/useColors";

const MOCK_REVIEWS = [
  { id: "r1", author: "Marko K.", rating: 5, text: "Odličan korisnik, sve prošlo bez problema!", date: "2026-05-12" },
  { id: "r2", author: "Ana P.", rating: 4, text: "Brza komunikacija, preporučam.", date: "2026-04-28" },
  { id: "r3", author: "Ivan S.", rating: 5, text: "Predmet je bio točno kako je opisano.", date: "2026-04-10" },
];

function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Feather key={s} name="star" size={size} color={s <= rating ? "#F5C100" : colors.mutedForeground} />
      ))}
    </View>
  );
}

export default function UserListingsScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { listings } = useListings();
  const [showInfo, setShowInfo] = useState(false);

  const pan = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gs) =>
        gs.dy > 6 && Math.abs(gs.dy) > Math.abs(gs.dx),
      onPanResponderMove: (_, gs) => {
        if (gs.dy > 0) pan.setValue(gs.dy);
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dy > 80 || gs.vy > 0.5) {
          Animated.timing(pan, { toValue: 700, duration: 200, useNativeDriver: true }).start(() => {
            setShowInfo(false);
            pan.setValue(0);
          });
        } else {
          Animated.spring(pan, { toValue: 0, useNativeDriver: true, bounciness: 4 }).start();
        }
      },
    })
  ).current;

  function openSheet() {
    pan.setValue(0);
    setShowInfo(true);
  }

  const userListings = listings.filter(
    (l) => l.userName === name && l.status === "active"
  );

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;
  const avgRating = 5.0;
  const joinYear = "2025";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.headerCenter, { opacity: pressed ? 0.75 : 1 }]}
          onPress={openSheet}
        >
          <View style={[styles.avatar, { backgroundColor: colors.muted, borderColor: colors.secondary }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {(name || "?").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Text style={[styles.headerName, { color: colors.foreground }]}>{name}</Text>
              <Feather name="info" size={13} color={colors.mutedForeground} />
            </View>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {userListings.length} aktivnih oglasa
            </Text>
          </View>
        </Pressable>
        <View style={{ width: 36 }} />
      </View>

      {userListings.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="package" size={40} color={colors.mutedForeground} />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Nema aktivnih oglasa
          </Text>
        </View>
      ) : (
        <FlatList
          data={userListings}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + 24 }]}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <ListingCard
                listing={item}
                onPress={() => router.push(`/listing/${item.id}`)}
              />
            </View>
          )}
        />
      )}

      {/* ── User info + reviews modal ────────────────────────────────────────── */}
      <Modal visible={showInfo} transparent animationType="slide" onRequestClose={() => setShowInfo(false)}>
        <Pressable style={styles.overlay} onPress={() => setShowInfo(false)}>
          <Animated.View
            style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border, paddingBottom: insets.bottom + 16, transform: [{ translateY: pan }] }]}
          >
            {/* Handle — drag zone */}
            <View {...panResponder.panHandlers} style={styles.dragZone}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
            </View>

            {/* Avatar + name */}
            <View style={styles.profileRow}>
              <View style={[styles.bigAvatar, { backgroundColor: colors.muted, borderColor: colors.secondary }]}>
                <Text style={[styles.bigAvatarText, { color: colors.primary }]}>
                  {(name || "?").charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ gap: 4 }}>
                <Text style={[styles.bigName, { color: colors.foreground }]}>{name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <StarRating rating={Math.round(avgRating)} size={15} />
                  <Text style={[styles.ratingText, { color: colors.mutedForeground }]}>{avgRating.toFixed(1)}</Text>
                </View>
                <Text style={[styles.joinText, { color: colors.mutedForeground }]}>
                  <Feather name="calendar" size={11} /> Član od {joinYear}.
                </Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{userListings.length}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Aktivni oglasi</Text>
              </View>
              <View style={[styles.statSep, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.secondary }]}>{MOCK_REVIEWS.length}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Recenzije</Text>
              </View>
              <View style={[styles.statSep, { backgroundColor: colors.border }]} />
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: "#F5C100" }]}>{avgRating.toFixed(1)}</Text>
                <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Ocjena</Text>
              </View>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            {/* Reviews */}
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Recenzije</Text>
            <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={false}>
              {MOCK_REVIEWS.map((r) => (
                <View key={r.id} style={[styles.reviewCard, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                  <View style={styles.reviewHeader}>
                    <Text style={[styles.reviewAuthor, { color: colors.foreground }]}>{r.author}</Text>
                    <StarRating rating={r.rating} size={12} />
                  </View>
                  <Text style={[styles.reviewText, { color: colors.mutedForeground }]}>{r.text}</Text>
                  <Text style={[styles.reviewDate, { color: colors.mutedForeground }]}>{r.date}</Text>
                </View>
              ))}
            </ScrollView>
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    justifyContent: "space-between",
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, paddingHorizontal: 8 },
  avatar: { width: 42, height: 42, borderRadius: 21, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontFamily: "Inter_700Bold" },
  headerName: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  grid: { padding: 12 },
  row: { gap: 10 },
  cardWrap: { flex: 1, maxWidth: "50%" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 12, gap: 16 },
  dragZone: { paddingVertical: 10, alignItems: "center" },
  handle: { width: 36, height: 4, borderRadius: 2, alignSelf: "center" },

  profileRow: { flexDirection: "row", alignItems: "center", gap: 16 },
  bigAvatar: { width: 64, height: 64, borderRadius: 32, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  bigAvatarText: { fontSize: 26, fontFamily: "Inter_700Bold" },
  bigName: { fontSize: 18, fontFamily: "Inter_700Bold" },
  ratingText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  joinText: { fontSize: 12, fontFamily: "Inter_400Regular" },

  divider: { height: 1 },
  statsRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-around" },
  statItem: { alignItems: "center", gap: 3 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  statSep: { width: 1, height: 36 },

  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold" },
  reviewCard: { borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 10, gap: 6 },
  reviewHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  reviewAuthor: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  reviewText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  reviewDate: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
