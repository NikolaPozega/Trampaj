import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { Listing } from "@/context/ListingsContext";

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

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

interface Props {
  listing: Listing;
  compact?: boolean;
}

export function ListingCard({ listing, compact }: Props) {
  const colors = useColors();

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/listing/${listing.id}`);
  }

  const iconName = (CATEGORY_ICONS[listing.category] ?? "package") as keyof typeof Feather.glyphMap;

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.985 : 1 }],
        },
        listing.status === "traded" && { opacity: 0.55 },
      ]}
    >
      <View style={[styles.iconBox, { backgroundColor: colors.accent }]}>
        <Feather name={iconName} size={compact ? 20 : 24} color={colors.primary} />
      </View>

      <View style={styles.content}>
        <View style={styles.topRow}>
          <Text
            style={[styles.title, { color: colors.foreground }]}
            numberOfLines={1}
          >
            {listing.title}
          </Text>
          {listing.status === "traded" && (
            <View style={[styles.tradedBadge, { backgroundColor: colors.secondary }]}>
              <Text style={[styles.tradedText, { color: colors.secondaryForeground }]}>Zamijenjeno</Text>
            </View>
          )}
        </View>

        <View style={styles.wantsRow}>
          <Feather name="refresh-cw" size={11} color={colors.primary} />
          <Text style={[styles.wantsText, { color: colors.primary }]} numberOfLines={1}>
            {listing.wantedFor}
          </Text>
        </View>

        <View style={styles.meta}>
          <View style={styles.metaItem}>
            <Feather name="map-pin" size={11} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{listing.location}</Text>
          </View>
          <View style={styles.metaDot} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{listing.userName}</Text>
          <View style={styles.metaDot} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{timeAgo(listing.createdAt)}</Text>
        </View>
      </View>

      <Feather name="chevron-right" size={16} color={colors.border} style={styles.arrow} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 10,
    gap: 12,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 3,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    flex: 1,
  },
  wantsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  wantsText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  metaText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  metaDot: {
    width: 2,
    height: 2,
    borderRadius: 1,
    backgroundColor: "#ccc",
  },
  tradedBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  tradedText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  arrow: {
    flexShrink: 0,
  },
});
