import { Feather } from "@expo/vector-icons";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";

const AD_POOL = [
  { id: "a1", sponsor: "Mall.hr", tagline: "Sve na jednom mjestu", url: "https://www.mall.hr", icon: "shopping-cart" as const, color: "#E53935" },
  { id: "a2", sponsor: "njuškalo.hr", tagline: "Oglasi koje tražiš", url: "https://www.njuskalo.hr", icon: "search" as const, color: "#1565C0" },
  { id: "a3", sponsor: "Konzum Online", tagline: "Dostava do vrata", url: "https://www.konzum.hr", icon: "package" as const, color: "#2E7D32" },
  { id: "a4", sponsor: "Booking.com", tagline: "Putuj povoljnije", url: "https://www.booking.com", icon: "map-pin" as const, color: "#003580" },
  { id: "a5", sponsor: "Rimac Store", tagline: "Električna budućnost", url: "https://www.rimac.com", icon: "zap" as const, color: "#C62828" },
  { id: "a6", sponsor: "Superknjižara", tagline: "Knjige na popustu", url: "https://www.superknjizara.hr", icon: "book" as const, color: "#6A1B9A" },
];

function pickAd(seed: string) {
  const idx = Math.abs(seed.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % AD_POOL.length;
  return AD_POOL[idx]!;
}

interface AdBannerSlotProps {
  size?: "small" | "bottom";
  seed?: string;
}

export function AdBannerSlot({ size = "small", seed = "banner" }: AdBannerSlotProps) {
  const colors = useColors();
  const height = size === "bottom" ? 52 : 44;
  const ad = pickAd(seed);
  return (
    <Pressable
      onPress={() => { Linking.openURL(ad.url).catch(() => {}); }}
      style={({ pressed }) => [
        styles.banner,
        { height, backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={[styles.iconCircle, { backgroundColor: colors.muted, width: 28, height: 28 }]}>
        <Feather name={ad.icon} size={13} color={ad.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.sponsor, { color: colors.foreground }]} numberOfLines={1}>{ad.sponsor}</Text>
        <Text style={[styles.tagline, { color: colors.mutedForeground }]} numberOfLines={1}>{ad.tagline}</Text>
      </View>
      <View style={[styles.adBadge, { backgroundColor: colors.muted }]}>
        <Text style={[styles.adBadgeText, { color: colors.mutedForeground }]}>oglas</Text>
      </View>
      <Text style={[styles.cta, { color: ad.color }]}>Posjeti →</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  iconCircle: {
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sponsor: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  tagline: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
  adBadge: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  adBadgeText: {
    fontSize: 8,
    fontFamily: "Inter_400Regular",
  },
  cta: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    minWidth: 60,
    textAlign: "right",
  },
});
