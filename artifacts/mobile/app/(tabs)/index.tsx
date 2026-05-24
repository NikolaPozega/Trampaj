import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  FlatList,
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
import { CATEGORIES, useListings } from "@/context/ListingsContext";
import { useColors } from "@/hooks/useColors";

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
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Sve");

  const filtered = useMemo(() => {
    return listings.filter((l) => {
      const matchesCategory =
        selectedCategory === "Sve" || l.category === selectedCategory;
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        l.title.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.wantedFor.toLowerCase().includes(q);
      return matchesCategory && matchesSearch && l.status === "active";
    });
  }, [listings, selectedCategory, search]);

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: topPad, backgroundColor: colors.background }]}>
        <View style={styles.logoRow}>
          <View style={[styles.logoIcon, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Feather name="refresh-cw" size={22} color={colors.primary} />
          </View>
          <Text style={[styles.logoText, { color: colors.foreground }]}>
            Trampaj<Text style={{ color: colors.secondary }}>.hr</Text>
          </Text>
        </View>

        <View style={[styles.searchBar, { backgroundColor: colors.muted, borderColor: colors.border }]}>
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

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          {CATEGORIES.map((cat) => {
            const selected = selectedCategory === cat;
            const icon = FILTER_ICONS[cat] ?? "package";
            return (
              <Pressable
                key={cat}
                onPress={() => setSelectedCategory(cat)}
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

      {!isLoaded ? (
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Učitavanje...</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ListingCard listing={item} />}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={[
            styles.list,
            filtered.length === 0 && styles.listEmpty,
            { paddingBottom: insets.bottom + (Platform.OS === "web" ? 60 : 100) },
          ]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <EmptyState
              icon="search"
              title="Nema oglasa"
              subtitle={
                search
                  ? `Nema rezultata za "${search}"`
                  : "U ovoj kategoriji nema aktivnih oglasa"
              }
            />
          }
        />
      )}

      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          router.push("/(tabs)/post");
        }}
        style={({ pressed }) => [
          styles.fab,
          {
            backgroundColor: colors.primary,
            opacity: pressed ? 0.85 : 1,
            transform: [{ scale: pressed ? 0.95 : 1 }],
            bottom: insets.bottom + (Platform.OS === "web" ? 70 : 100),
          },
        ]}
      >
        <Feather name="plus" size={22} color={colors.primaryForeground} />
        <Text style={[styles.fabText, { color: colors.primaryForeground }]}>Objavi oglas</Text>
      </Pressable>
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
    paddingVertical: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
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
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  listEmpty: { flex: 1 },
  columnWrapper: {
    gap: 10,
    paddingHorizontal: 4,
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
  fab: {
    position: "absolute",
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 13,
    borderRadius: 30,
    shadowColor: "#F5C100",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  fabText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
});
