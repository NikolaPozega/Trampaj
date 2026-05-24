import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ListingCard } from "@/components/ListingCard";
import { useListings } from "@/context/ListingsContext";
import { useColors } from "@/hooks/useColors";

export default function UserListingsScreen() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { listings } = useListings();

  const userListings = listings.filter(
    (l) => l.userName === name && l.status === "active"
  );

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={[styles.avatar, { backgroundColor: colors.muted, borderColor: colors.secondary }]}>
            <Text style={[styles.avatarText, { color: colors.primary }]}>
              {(name || "?").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={[styles.headerName, { color: colors.foreground }]}>{name}</Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]}>
              {userListings.length} aktivnih oglasa
            </Text>
          </View>
        </View>
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
          contentContainerStyle={styles.grid}
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
  grid: { padding: 12, paddingBottom: 40 },
  row: { gap: 10 },
  cardWrap: { flex: 1, maxWidth: "50%" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  emptyText: { fontSize: 15, fontFamily: "Inter_400Regular" },
});
