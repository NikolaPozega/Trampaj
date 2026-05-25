import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import ConfettiCannon from "react-native-confetti-cannon";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ChatMessage, MessageType } from "@/context/ChatContext";
import { useChat } from "@/context/ChatContext";

const { width: SW } = Dimensions.get("window");

const C = {
  bg: "#06101F",
  header: "rgba(6,16,31,0.97)",
  primary: "#F5C100",
  secondary: "#38BDF8",
  myBg: "rgba(245,193,0,0.12)",
  myBorder: "rgba(245,193,0,0.4)",
  theirBg: "rgba(56,189,248,0.07)",
  theirBorder: "rgba(56,189,248,0.25)",
  inputBg: "rgba(8,21,46,0.95)",
  inputBorder: "rgba(56,189,248,0.32)",
  mutedBg: "#132846",
  muted: "#7B91A8",
  text: "#FFFFFF",
  red: "#EF4444",
};

type HsStatus = "idle" | "pending_me" | "pending_them" | "accepted" | "rejected";

function getHsStatus(messages: ChatMessage[]): HsStatus {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (!m.type || m.type === "text") continue;
    if (m.type === "handshake_accepted") return "accepted";
    if (m.type === "handshake_rejected") return "rejected";
    if (m.type === "handshake_request") return m.fromMe ? "pending_me" : "pending_them";
  }
  return "idle";
}

// ─── Compact fixed Handshake Bar ─────────────────────────────────────────────
function HandshakeBar({ onPress }: { onPress: () => void }) {
  const offsetL = useRef(new Animated.Value(0)).current;
  const offsetR = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(offsetL, { toValue: 7, duration: 700, useNativeDriver: true }),
          Animated.timing(offsetR, { toValue: -7, duration: 700, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(offsetL, { toValue: 0, duration: 700, useNativeDriver: true }),
          Animated.timing(offsetR, { toValue: 0, duration: 700, useNativeDriver: true }),
        ]),
      ])
    );
    a.start();
    return () => a.stop();
  }, [offsetL, offsetR]);

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onPress();
      }}
      style={({ pressed }) => [styles.hsBar, { opacity: pressed ? 0.75 : 1 }]}
    >
      <Animated.Text style={[styles.hsBarFist, { transform: [{ translateX: offsetL }] }]}>🫱</Animated.Text>
      <Animated.Text style={[styles.hsBarFist, { transform: [{ translateX: offsetR }] }]}>🫲</Animated.Text>
      <Text style={styles.hsBarLabel}>Zaključi trampu</Text>
    </Pressable>
  );
}

// ─── Reaching hand (from them) ───────────────────────────────────────────────
function ReachingHand({
  otherName,
  onAccept,
  onReject,
}: {
  otherName: string;
  onAccept: () => void;
  onReject: () => void;
}) {
  const reach = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(reach, { toValue: 16, duration: 700, useNativeDriver: true }),
        Animated.timing(reach, { toValue: 0, duration: 700, useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [reach]);

  return (
    <View style={styles.reachBox}>
      <View style={styles.reachFists}>
        <Text style={styles.hsFist}>🫱</Text>
        <Animated.Text style={[styles.hsFist, { transform: [{ translateX: reach }] }]}>
          🫲
        </Animated.Text>
      </View>
      <Text style={styles.reachName}>{otherName} želi zaključiti trampu</Text>
      <View style={styles.reachBtns}>
        <Pressable
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onReject();
          }}
          style={styles.rejectBtn}
        >
          <Feather name="x" size={16} color={C.red} />
          <Text style={styles.rejectText}>Odbij</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            onAccept();
          }}
          style={styles.acceptBtn}
        >
          <Text style={styles.acceptText}>Prihvati  🤝</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Mini badge (pending_me, top-right) ──────────────────────────────────────
function MiniBadge() {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.3, duration: 600, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 600, useNativeDriver: true }),
      ])
    );
    a.start();
    return () => a.stop();
  }, [scale]);
  return (
    <Animated.View style={[styles.miniBadge, { transform: [{ scale }] }]}>
      <Text style={{ fontSize: 18 }}>🫱</Text>
    </Animated.View>
  );
}

// ─── Deal overlay (confetti + card) ─────────────────────────────────────────
function DealOverlay({ onDismiss }: { onDismiss: () => void }) {
  const cardScale = useRef(new Animated.Value(0)).current;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const confettiRef = useRef<any>(null);

  useEffect(() => {
    Animated.spring(cardScale, {
      toValue: 1,
      tension: 70,
      friction: 6,
      useNativeDriver: true,
    }).start();
    setTimeout(() => confettiRef.current?.start(), 250);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [cardScale]);

  return (
    <View style={styles.overlay}>
      <ConfettiCannon
        ref={confettiRef}
        count={200}
        origin={{ x: SW / 2, y: -20 }}
        colors={["#F5C100", "#38BDF8", "#ffffff", "#FFD700", "#87CEEB", "#FFA500"]}
        fadeOut
        autoStart={false}
        fallSpeed={3200}
        explosionSpeed={380}
      />
      <Animated.View style={[styles.dealCard, { transform: [{ scale: cardScale }] }]}>
        <Text style={styles.dealEmoji}>🤝</Text>
        <Text style={styles.dealTitle}>Trampa zaključena!</Text>
        <Text style={styles.dealSub}>Sretna zamjena! 🥂</Text>
        <Pressable
          onPress={onDismiss}
          style={({ pressed }) => [styles.dealBtn, { opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={styles.dealBtnText}>Super!</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function ChatScreen() {
  const { listingId, listingTitle, otherUser } = useLocalSearchParams<{
    listingId: string;
    listingTitle: string;
    otherUser: string;
  }>();
  const insets = useSafeAreaInsets();
  const { conversations, getOrCreateConversation, sendMessage, sendSpecialMessage, markAsRead, markDealShown, deleteConversation } =
    useChat();

  const [text, setText] = useState("");
  const [showDeal, setShowDeal] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const prevHsRef = useRef<HsStatus | null>(null);

  // Create conversation in effect (not during render) to avoid ChatProvider update-during-render warning
  useEffect(() => {
    if (listingId && !conversations.find((c) => c.listingId === listingId)) {
      getOrCreateConversation(listingId, listingTitle ?? "", otherUser ?? "");
    }
  }, [listingId]); // eslint-disable-line react-hooks/exhaustive-deps

  const liveConv = conversations.find((c) => c.listingId === listingId);
  const hsStatus = liveConv ? getHsStatus(liveConv.messages) : "idle";

  // Mark as read
  useEffect(() => {
    if (liveConv?.id) markAsRead(liveConv.id);
  }, [liveConv?.id, markAsRead]);

  // Scroll to end
  useEffect(() => {
    if (!liveConv) return;
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [liveConv?.messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show deal overlay only on live transition (not on re-entry if already shown)
  useEffect(() => {
    if (!liveConv) return;
    if (prevHsRef.current === null) {
      prevHsRef.current = hsStatus;
      return;
    }
    if (hsStatus === "accepted" && prevHsRef.current !== "accepted" && !liveConv.dealShown) {
      setShowDeal(true);
    }
    prevHsRef.current = hsStatus;
  }, [hsStatus, liveConv?.dealShown]); // eslint-disable-line react-hooks/exhaustive-deps

  const convId = liveConv?.id ?? "";

  const handleSend = useCallback(() => {
    if (!text.trim() || !convId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage(convId, text.trim());
    setText("");
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
  }, [text, convId, sendMessage]);

  const handleHandshake = useCallback(() => {
    if (!convId) return;
    sendSpecialMessage(convId, "handshake_request");
  }, [convId, sendSpecialMessage]);

  const handleAccept = useCallback(() => {
    if (!convId) return;
    sendSpecialMessage(convId, "handshake_accepted");
  }, [convId, sendSpecialMessage]);

  const handleReject = useCallback(() => {
    if (!convId) return;
    sendSpecialMessage(convId, "handshake_rejected");
  }, [convId, sendSpecialMessage]);

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 12 : 6);

  const renderMessage = useCallback(
    ({ item, index }: { item: ChatMessage; index: number }) => {
      if (!liveConv) return null;
      const prev = liveConv.messages[index - 1];
      const showAvatar = !item.fromMe && (!prev || prev.fromMe || prev.type !== "text");

      // Handshake request from them → reaching hand + accept/reject
      if (item.type === "handshake_request" && !item.fromMe) {
        return (
          <ReachingHand
            otherName={liveConv.otherUserName}
            onAccept={handleAccept}
            onReject={handleReject}
          />
        );
      }

      // Handshake request from me → waiting bubble
      if (item.type === "handshake_request" && item.fromMe) {
        return (
          <View style={styles.pendingRow}>
            <Text style={styles.pendingText}>
              🫱 Čekaš potvrdu od {liveConv.otherUserName}…
            </Text>
          </View>
        );
      }

      // Deal accepted
      if (item.type === "handshake_accepted") {
        return (
          <View style={styles.dealDoneRow}>
            <View style={styles.dealDoneLine} />
            <Text style={styles.dealDoneEmoji}>🤝</Text>
            <Text style={styles.dealDoneText}>Trampa zaključena!</Text>
            <View style={styles.dealDoneLine} />
          </View>
        );
      }

      // Deal rejected
      if (item.type === "handshake_rejected") {
        return (
          <View style={styles.rejectedRow}>
            <Text style={styles.rejectedEmoji}>✊</Text>
            <Text style={styles.rejectedText}>Trampa nije zaključena</Text>
          </View>
        );
      }

      // Regular text bubble
      return (
        <View style={[styles.msgRow, item.fromMe && styles.msgRowMe]}>
          {!item.fromMe && (
            <View style={[styles.msgAvatar, { opacity: showAvatar ? 1 : 0 }]}>
              <Text style={styles.msgAvatarText}>
                {liveConv.otherUserName.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={[styles.bubble, item.fromMe ? styles.bubbleMe : styles.bubbleThem]}>
            <Text style={[styles.bubbleText, { color: item.fromMe ? C.primary : C.text }]}>
              {item.text}
            </Text>
            <Text style={styles.bubbleTime}>
              {new Date(item.createdAt).toLocaleTimeString("hr", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </View>
        </View>
      );
    },
    [liveConv, handleAccept, handleReject]
  );

  if (!liveConv) {
    return (
      <View style={[styles.root, { justifyContent: "center", alignItems: "center" }]}>
        <Text style={{ color: C.muted, fontSize: 13 }}>Učitavanje...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        {/* ── Header ── */}
        <View style={[styles.header, { paddingTop: topPad }]}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="arrow-left" size={18} color={C.text} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.headerCenter, { opacity: pressed ? 0.75 : 1 }]}
            onPress={() =>
              router.push(`/user/${encodeURIComponent(liveConv.otherUserName)}`)
            }
          >
            <View style={styles.headerAvatar}>
              <Text style={styles.headerAvatarText}>
                {(liveConv.otherUserName || "?").charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.headerName} numberOfLines={1}>
                {liveConv.otherUserName}
              </Text>
              <Text style={styles.headerSub} numberOfLines={1}>
                {liveConv.listingTitle}
              </Text>
            </View>
          </Pressable>

          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {hsStatus === "pending_me" && <MiniBadge />}
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              Alert.alert(
                "Obriši razgovor",
                "Obrisati ovaj razgovor? Ova radnja je trajna.",
                [
                  { text: "Odustani", style: "cancel" },
                  {
                    text: "Obriši",
                    style: "destructive",
                    onPress: () => {
                      deleteConversation(liveConv.id);
                      router.back();
                    },
                  },
                ]
              );
            }}
            style={({ pressed }) => [styles.backBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Feather name="trash-2" size={16} color={C.red} />
          </Pressable>
        </View>
        </View>

        {/* ── Fixed Handshake Bar (below header, above messages) ── */}
        {(hsStatus === "idle" || hsStatus === "rejected") && (
          <HandshakeBar onPress={handleHandshake} />
        )}

        {/* ── Messages ── */}
        <FlatList
          ref={flatListRef}
          data={liveConv.messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.msgList}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
          renderItem={renderMessage}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.emptyChatText}>Nema poruka — započni razgovor</Text>
            </View>
          }
        />

        {/* ── Input Bar ── */}
        <View style={[styles.inputBar, { paddingBottom: bottomPad }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Napiši poruku..."
            placeholderTextColor={C.muted}
            style={styles.input}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            blurOnSubmit={false}
          />
          <Pressable
            onPress={handleSend}
            disabled={!text.trim()}
            style={({ pressed }) => [
              styles.sendBtn,
              {
                backgroundColor: text.trim() ? C.primary : C.mutedBg,
                opacity: pressed ? 0.8 : 1,
              },
            ]}
          >
            <Feather name="send" size={17} color={text.trim() ? "#08152E" : C.muted} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* ── Deal Overlay ── */}
      {showDeal && (
        <DealOverlay
          onDismiss={() => {
            setShowDeal(false);
            markDealShown(liveConv.id);
          }}
        />
      )}
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 12,
    backgroundColor: C.header,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(56,189,248,0.2)",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(56,189,248,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    paddingHorizontal: 8,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(245,193,0,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(245,193,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.primary },
  headerName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.text },
  headerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: C.muted },

  miniBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(245,193,0,0.12)",
    borderWidth: 1,
    borderColor: "rgba(245,193,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Messages list
  msgList: { paddingHorizontal: 12, paddingTop: 14, paddingBottom: 8, gap: 4 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 4 },
  msgRowMe: { flexDirection: "row-reverse" },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    flexShrink: 0,
    backgroundColor: "rgba(56,189,248,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  msgAvatarText: { fontSize: 11, fontFamily: "Inter_700Bold", color: C.secondary },

  bubble: {
    maxWidth: "75%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 2,
    borderWidth: 1,
  },
  bubbleMe: {
    backgroundColor: C.myBg,
    borderColor: C.myBorder,
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    backgroundColor: C.theirBg,
    borderColor: C.theirBorder,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  bubbleTime: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.3)",
    alignSelf: "flex-end",
  },

  // Empty state
  emptyChat: { flex: 1, alignItems: "center", paddingTop: 40 },
  emptyChatText: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.muted },

  // Handshake Bar (compact, fixed between header and messages)
  hsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "rgba(245,193,0,0.06)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(245,193,0,0.18)",
  },
  hsBarFist: { fontSize: 20 },
  hsFist: { fontSize: 30 },
  hsBarLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: C.primary,
    opacity: 0.9,
  },

  // Reaching hand (from them)
  reachBox: {
    alignSelf: "center",
    alignItems: "center",
    backgroundColor: "rgba(56,189,248,0.06)",
    borderWidth: 1,
    borderColor: "rgba(56,189,248,0.28)",
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 20,
    marginVertical: 8,
    marginHorizontal: 20,
    gap: 8,
  },
  reachFists: { flexDirection: "row", gap: 4 },
  reachName: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.muted },
  reachBtns: { flexDirection: "row", gap: 12, marginTop: 4 },
  rejectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: "rgba(239,68,68,0.08)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.35)",
  },
  rejectText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.red },
  acceptBtn: {
    paddingVertical: 9,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: "rgba(245,193,0,0.14)",
    borderWidth: 1,
    borderColor: "rgba(245,193,0,0.45)",
  },
  acceptText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: C.primary },

  // Pending row (me waiting)
  pendingRow: {
    alignSelf: "center",
    paddingVertical: 6,
    paddingHorizontal: 16,
    marginVertical: 4,
  },
  pendingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: C.muted,
    fontStyle: "italic",
  },

  // Deal done in messages
  dealDoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginVertical: 16,
    paddingHorizontal: 20,
  },
  dealDoneLine: { flex: 1, height: 1, backgroundColor: "rgba(245,193,0,0.25)" },
  dealDoneEmoji: { fontSize: 32 },
  dealDoneText: { fontSize: 14, fontFamily: "Inter_700Bold", color: C.primary },
  rejectedRow: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 10,
    opacity: 0.55,
  },
  rejectedEmoji: { fontSize: 22 },
  rejectedText: { fontSize: 13, fontFamily: "Inter_400Regular", color: C.muted },

  // Deal overlay
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6,16,31,0.88)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99,
  },
  dealCard: {
    backgroundColor: "#0D2045",
    borderWidth: 1.5,
    borderColor: "rgba(245,193,0,0.45)",
    borderRadius: 24,
    padding: 36,
    alignItems: "center",
    gap: 10,
    width: SW - 48,
  },
  dealEmoji: { fontSize: 72, marginBottom: 4 },
  dealTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: C.primary },
  dealSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: C.muted },
  dealBtn: {
    marginTop: 14,
    backgroundColor: C.primary,
    paddingVertical: 13,
    paddingHorizontal: 48,
    borderRadius: 24,
  },
  dealBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#08152E" },

  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    backgroundColor: C.inputBg,
    borderTopWidth: 1,
    borderTopColor: C.inputBorder,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: C.inputBorder,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: C.text,
    backgroundColor: "rgba(19,40,70,0.55)",
    maxHeight: 100,
    minHeight: 44,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
