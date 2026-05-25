import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, Stack } from "expo-router";
import React from "react";
import { Alert, Pressable, StyleSheet, Text, View, FlatList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChat } from "@/context/ChatContext";
import { useColors } from "@/hooks/useColors";
import type { Conversation } from "@/context/ChatContext";

export default function InboxScreen() {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const { conversations, deleteConversation } = useChat();

  const sorted = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);

  function getLastText(conv: Conversation) {
    const m = conv.messages[conv.messages.length - 1];
    if (!m) return "Nema poruka";
    if (m.type === "handshake_accepted") return "🤝 Trampa zaključena!";
    if (m.type === "handshake_request") return m.fromMe ? "🫱 Poslao/la zahtjev za zamjenu" : "🫱 Zahtjev za zamjenu";
    if (m.type === "handshake_rejected") return "Trampa odbijena";
    return (m.fromMe ? "Ti: " : "") + m.text;
  }

  function confirmDelete(conv: Conversation) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      "Obriši razgovor",
      `Obrišti razgovor s ${conv.otherUserName}? Ova radnja je trajna.`,
      [
        { text: "Odustani", style: "cancel" },
        {
          text: "Obriši",
          style: "destructive",
          onPress: () => deleteConversation(conv.id),
        },
      ]
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.title, { color: colors.foreground }]}>Poruke</Text>
        <View style={{ width: 36 }} />
      </View>

      {sorted.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="mail" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nema razgovora</Text>
          <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>
            Kad pokrneš razgovor o nekom oglasu, pojavit će se ovdje
          </Text>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingVertical: 12, gap: 1 }}
          renderItem={({ item: conv }) => {
            const lastMsg = conv.messages[conv.messages.length - 1];
            const unread = conv.messages.filter(
              (m) => !m.fromMe && m.createdAt > (conv.lastReadAt ?? 0)
            ).length;
            return (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  router.push({
                    pathname: "/chat/[listingId]",
                    params: { listingId: conv.listingId, listingTitle: conv.listingTitle, otherUser: conv.otherUserName },
                  });
                }}
                onLongPress={() => confirmDelete(conv)}
                style={({ pressed }) => [
                  styles.row,
                  { backgroundColor: unread > 0 ? `${colors.secondary}08` : colors.background, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                {/* Avatar */}
                <View style={[styles.avatar, { backgroundColor: colors.muted, borderColor: unread > 0 ? colors.secondary : colors.border }]}>
                  <Text style={[styles.avatarText, { color: unread > 0 ? colors.secondary : colors.primary }]}>
                    {(conv.otherUserName || "?").charAt(0).toUpperCase()}
                  </Text>
                  {unread > 0 && (
                    <View style={[styles.unreadDot, { backgroundColor: colors.secondary }]}>
                      <Text style={styles.unreadDotText}>{unread > 9 ? "9+" : unread}</Text>
                    </View>
                  )}
                </View>

                {/* Content */}
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={[styles.name, { color: colors.foreground, fontFamily: unread > 0 ? "Inter_700Bold" : "Inter_600SemiBold" }]} numberOfLines={1}>
                      {conv.otherUserName}
                    </Text>
                    {lastMsg && (
                      <Text style={[styles.time, { color: colors.mutedForeground }]}>
                        {new Date(lastMsg.createdAt).toLocaleTimeString("hr", { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    )}
                  </View>
                  <Text style={[styles.listing, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {conv.listingTitle}
                  </Text>
                  <Text
                    style={[styles.preview, { color: unread > 0 ? colors.foreground : colors.mutedForeground, fontFamily: unread > 0 ? "Inter_500Medium" : "Inter_400Regular" }]}
                    numberOfLines={1}
                  >
                    {getLastText(conv)}
                  </Text>
                </View>

                {/* Delete button */}
                <Pressable
                  onPress={() => confirmDelete(conv)}
                  style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.6 : 0.45 }]}
                  hitSlop={8}
                >
                  <Feather name="trash-2" size={14} color={colors.destructive} />
                </Pressable>

                <Feather name="chevron-right" size={14} color={colors.mutedForeground} style={{ opacity: 0.5 }} />
              </Pressable>
            );
          }}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.border }]} />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 17, fontFamily: "Inter_700Bold" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarText: { fontSize: 17, fontFamily: "Inter_700Bold" },
  unreadDot: {
    position: "absolute",
    top: -3,
    right: -3,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  unreadDotText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#08152E" },
  name: { fontSize: 14, flex: 1 },
  listing: { fontSize: 11, fontFamily: "Inter_400Regular" },
  preview: { fontSize: 12, lineHeight: 17 },
  time: { fontSize: 11, fontFamily: "Inter_400Regular" },
  deleteBtn: { padding: 4 },
  separator: { height: 1, marginLeft: 74 },
});
