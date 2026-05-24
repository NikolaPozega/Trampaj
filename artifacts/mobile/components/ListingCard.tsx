import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
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

interface Props {
  listing: Listing;
}

export function ListingCard({ listing }: Props) {
  const colors = useColors();
  const hasPrice = listing.price != null && listing.price > 0;
  const iconName = CATEGORY_ICONS[listing.category] ?? "package";

  function handlePress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push(`/listing/${listing.id}`);
  }

  return (
    <Pressable
      onPress={handlePress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          opacity: pressed ? 0.88 : listing.status === "traded" ? 0.5 : 1,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}
    >
      <View style={[styles.imageArea, { backgroundColor: colors.muted }]}>
        {listing.imageUri ? (
          <Image
            source={{ uri: listing.imageUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <Feather name={iconName} size={30} color={colors.secondary} />
        )}
        {listing.status === "traded" && (
          <View style={styles.tradedOverlay}>
            <Text style={styles.tradedOverlayText}>Zamijenjeno</Text>
          </View>
        )}
        {hasPrice && (
          <View style={[styles.priceBadge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.priceBadgeText, { color: colors.primaryForeground }]}>
              Vrijednost: {listing.price} €
            </Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
          {listing.title}
        </Text>
        <View style={styles.tradeRow}>
          <Feather name="refresh-cw" size={11} color={colors.primary} />
          <Text style={[styles.tradeText, { color: colors.primary }]} numberOfLines={1}>
            {listing.wantedFor}
          </Text>
        </View>
        <View style={styles.meta}>
          <Feather name="map-pin" size={10} color={colors.mutedForeground} />
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{listing.location}</Text>
          <Text style={[styles.dot, { color: colors.mutedForeground }]}>·</Text>
          <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{timeAgo(listing.createdAt)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
    flex: 1,
    marginBottom: 10,
  },
  imageArea: {
    height: 130,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  tradedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  tradedOverlayText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  priceBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  priceBadgeText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  body: {
    padding: 10,
    gap: 4,
  },
  title: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 18,
  },
  tradeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  tradeText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 1,
  },
  metaText: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  dot: { fontSize: 10 },
});
