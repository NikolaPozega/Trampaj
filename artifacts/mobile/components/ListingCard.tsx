import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { Listing } from "@/context/ListingsContext";
import { CONDITION_COLORS } from "@/context/ListingsContext";

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
  onPress?: () => void;
}

export function ListingCard({ listing, onPress }: Props) {
  const colors = useColors();
  const hasPrice = listing.price != null && listing.price > 0;
  const iconName = CATEGORY_ICONS[listing.category] ?? "package";
  const conditionColor = listing.condition ? CONDITION_COLORS[listing.condition] : null;

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
        {(listing.imageUris?.[0] ?? listing.imageUri) ? (
          <Image
            source={{ uri: listing.imageUris?.[0] ?? listing.imageUri! }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <Feather name={iconName} size={22} color={colors.secondary} />
        )}
        {listing.status === "traded" && (
          <View style={styles.tradedOverlay}>
            <Text style={styles.tradedOverlayText}>Zamijenjeno</Text>
          </View>
        )}
        {listing.condition && listing.status !== "traded" && (
          <View style={[styles.conditionBadge, { backgroundColor: "rgba(8,21,46,0.72)", borderColor: conditionColor + "99" }]}>
            <View style={[styles.conditionDot, { backgroundColor: conditionColor! }]} />
            <Text style={[styles.conditionText, { color: "#fff" }]}>{listing.condition}</Text>
          </View>
        )}
      </View>

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={2}>
            {listing.title}
          </Text>
          <Text style={[styles.price, { color: hasPrice ? colors.primary : colors.mutedForeground }]}>
            {hasPrice ? `${listing.price} €` : "Dogovor"}
          </Text>
        </View>

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
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
    flex: 1,
    marginBottom: 8,
  },
  imageArea: {
    height: 90,
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
  conditionDot: { width: 6, height: 6, borderRadius: 3, marginRight: 3 },
  conditionBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  conditionText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.2,
  },
  body: {
    padding: 8,
    gap: 3,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 3,
  },
  title: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 15,
    flex: 1,
  },
  price: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    flexShrink: 0,
    marginTop: 1,
  },
  tradeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  tradeText: {
    fontSize: 10,
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
    fontSize: 9,
    fontFamily: "Inter_400Regular",
  },
  dot: { fontSize: 9 },
});
