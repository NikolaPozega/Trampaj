import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import type { Listing } from "@/context/ListingsContext";
import { CONDITION_COLORS } from "@/context/ListingsContext";

const NEON_CYAN = "rgba(0, 200, 255, 0.92)";
const NEON_YELLOW = "rgba(245, 193, 0, 0.92)";
const CARD_BG = "#09152b";
const BORDER_W = 1.5;
const RADIUS = 14;

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
      style={({ pressed }) => ({
        flex: 1,
        marginBottom: 8,
        borderRadius: RADIUS,
        opacity: pressed ? 0.85 : listing.status === "traded" ? 0.45 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
        elevation: 6,
        shadowColor: "#00C8FF",
        shadowOffset: { width: -3, height: -3 },
        shadowOpacity: 0.18,
        shadowRadius: 10,
      })}
    >
      {/* Gradient border wrapper */}
      <LinearGradient
        colors={[NEON_CYAN, NEON_YELLOW]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: RADIUS, padding: BORDER_W }}
      >
        <View style={[styles.inner, { backgroundColor: CARD_BG }]}>
          {/* Image area */}
          <View style={styles.imageArea}>
            {(listing.imageUris?.[0] ?? listing.imageUri) ? (
              <Image
                source={{ uri: listing.imageUris?.[0] ?? listing.imageUri! }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <View style={styles.iconWrap}>
                <Feather name={iconName} size={20} color="rgba(0,200,255,0.55)" />
              </View>
            )}
            {listing.status === "traded" && (
              <View style={styles.tradedOverlay}>
                <Text style={styles.tradedOverlayText}>Zamijenjeno</Text>
              </View>
            )}
            {listing.condition && listing.status !== "traded" && (
              <View
                style={[
                  styles.conditionBadge,
                  {
                    backgroundColor: "rgba(9,21,43,0.82)",
                    borderColor: (conditionColor ?? "#fff") + "88",
                  },
                ]}
              >
                <View style={[styles.conditionDot, { backgroundColor: conditionColor! }]} />
                <Text style={[styles.conditionText, { color: "#fff" }]}>
                  {listing.condition}
                </Text>
              </View>
            )}
          </View>

          {/* Body */}
          <View style={styles.body}>
            <View style={styles.titleRow}>
              <Text
                style={[styles.title, { color: "#e8f4ff" }]}
                numberOfLines={2}
              >
                {listing.title}
              </Text>
              <Text
                style={[
                  styles.price,
                  { color: hasPrice ? NEON_YELLOW : "rgba(0,200,255,0.6)" },
                ]}
              >
                {hasPrice ? `${listing.price} €` : "Dogovor"}
              </Text>
            </View>

            {/* Thin cyan divider */}
            <View style={styles.divider} />

            <View style={styles.tradeRow}>
              <Feather name="refresh-cw" size={10} color={NEON_CYAN} />
              <Text style={styles.tradeText} numberOfLines={1}>
                {listing.wantedFor}
              </Text>
            </View>
            <View style={styles.meta}>
              <Feather name="map-pin" size={9} color="rgba(0,200,255,0.45)" />
              <Text style={styles.metaText}>{listing.location}</Text>
              <Text style={styles.metaDot}>·</Text>
              <Text style={styles.metaText}>{timeAgo(listing.createdAt)}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: {
    borderRadius: RADIUS - BORDER_W,
    overflow: "hidden",
  },
  imageArea: {
    height: 90,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#060e1e",
    position: "relative",
    overflow: "hidden",
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,200,255,0.07)",
    alignItems: "center",
    justifyContent: "center",
  },
  tradedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  tradedOverlayText: {
    color: "#fff",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.3,
  },
  conditionDot: { width: 5, height: 5, borderRadius: 3, marginRight: 3 },
  conditionBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  conditionText: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.3,
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
  divider: {
    height: 1,
    backgroundColor: "rgba(0,200,255,0.12)",
    marginVertical: 1,
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
    color: "rgba(0,200,255,0.75)",
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
    color: "rgba(0,200,255,0.4)",
  },
  metaDot: {
    fontSize: 9,
    color: "rgba(0,200,255,0.3)",
  },
});
