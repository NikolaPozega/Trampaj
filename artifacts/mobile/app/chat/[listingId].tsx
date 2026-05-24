import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChat } from "@/context/ChatContext";
import { useColors } from "@/hooks/useColors";

export default function ChatScreen() {
  const { listingId, listingTitle, otherUser } = useLocalSearchParams<{
    listingId: string;
    listingTitle: string;
    otherUser: string;
  }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getOrCreateConversation, sendMessage, conversations } = useChat();
  const [text, setText] = useState("");
  const flatListRef = useRef<FlatList>(null);

  const conversation = conversations.find((c) => c.listingId === listingId)
    ?? getOrCreateConversation(listingId, listingTitle ?? "", otherUser ?? "");

  const liveConversation = conversations.find((c) => c.listingId === listingId) ?? conversation;

  useEffect(() => {
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }, [liveConversation.messages.length]);

  function handleSend() {
    if (!text.trim()) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    sendMessage(liveConversation.id, text.trim());
    setText("");
    setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
  }

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;
  const bottomPad = insets.bottom + (Platform.OS === "web" ? 16 : 8);

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.topBar, { paddingTop: topPad, borderBottomColor: colors.border }]}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backCircle, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="arrow-left" size={18} color={colors.foreground} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.topBarCenter, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            router.push(`/user/${encodeURIComponent(liveConversation.otherUserName)}`);
          }}
        >
          <View style={[styles.avatarSmall, { backgroundColor: colors.muted, borderColor: colors.secondary }]}>
            <Text style={[styles.avatarSmallText, { color: colors.primary }]}>
              {(liveConversation.otherUserName || "?").charAt(0).toUpperCase()}
            </Text>
          </View>
          <View>
            <Text style={[styles.topBarName, { color: colors.foreground }]} numberOfLines={1}>
              {liveConversation.otherUserName}
            </Text>
            <Text style={[styles.topBarSub, { color: colors.mutedForeground }]} numberOfLines={1}>
              Vidi sve oglase →
            </Text>
          </View>
        </Pressable>
        <View style={{ width: 36 }} />
      </View>

      <FlatList
        ref={flatListRef}
        data={liveConversation.messages}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.messagesList, { paddingBottom: 16 }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        renderItem={({ item, index }) => {
          const prevMsg = liveConversation.messages[index - 1];
          const showAvatar = !item.fromMe && (!prevMsg || prevMsg.fromMe);
          return (
            <View style={[styles.messageRow, item.fromMe && styles.messageRowMe]}>
              {!item.fromMe && (
                <View style={[styles.msgAvatar, { backgroundColor: colors.muted, opacity: showAvatar ? 1 : 0 }]}>
                  <Text style={[styles.msgAvatarText, { color: colors.primary }]}>
                    {liveConversation.otherUserName.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <View
                style={[
                  styles.bubble,
                  item.fromMe
                    ? [styles.bubbleMe, { backgroundColor: colors.primary }]
                    : [styles.bubbleThem, { backgroundColor: colors.card, borderColor: colors.border }],
                ]}
              >
                <Text style={[styles.bubbleText, { color: item.fromMe ? colors.primaryForeground : colors.foreground }]}>
                  {item.text}
                </Text>
                <Text style={[styles.bubbleTime, { color: item.fromMe ? "rgba(0,0,0,0.4)" : colors.mutedForeground }]}>
                  {new Date(item.createdAt).toLocaleTimeString("hr", { hour: "2-digit", minute: "2-digit" })}
                </Text>
              </View>
            </View>
          );
        }}
      />

      <View style={[styles.inputBar, { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: bottomPad }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Napiši poruku..."
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { backgroundColor: colors.muted, borderColor: colors.border, color: colors.foreground }]}
          multiline
          maxLength={500}
          onSubmitEditing={handleSend}
          returnKeyType="send"
          blurOnSubmit={false}
        />
        <Pressable
          onPress={handleSend}
          disabled={!text.trim()}
          style={({ pressed }) => [
            styles.sendBtn,
            {
              backgroundColor: text.trim() ? colors.primary : colors.muted,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <Feather name="send" size={18} color={text.trim() ? colors.primaryForeground : colors.mutedForeground} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    justifyContent: "space-between",
    borderBottomWidth: 1,
  },
  backCircle: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  topBarCenter: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, paddingHorizontal: 8 },
  avatarSmall: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  avatarSmallText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  topBarName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  topBarSub: { fontSize: 11, fontFamily: "Inter_400Regular" },
  messagesList: { paddingHorizontal: 12, paddingTop: 12, gap: 4 },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 4 },
  messageRowMe: { flexDirection: "row-reverse" },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  msgAvatarText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  bubble: { maxWidth: "75%", borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9, gap: 2 },
  bubbleMe: { borderBottomRightRadius: 4 },
  bubbleThem: { borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  bubbleTime: { fontSize: 10, fontFamily: "Inter_400Regular", alignSelf: "flex-end" },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 12, paddingTop: 10, borderTopWidth: 1 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    maxHeight: 100,
    minHeight: 44,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", flexShrink: 0 },
});
