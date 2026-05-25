import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { sendLocalNotification } from "@/utils/notifications";

export type MessageType = "text" | "handshake_request" | "handshake_accepted" | "handshake_rejected";

export interface ChatMessage {
  id: string;
  text: string;
  type: MessageType;
  fromMe: boolean;
  createdAt: number;
}

export interface Conversation {
  id: string;
  listingId: string;
  listingTitle: string;
  otherUserName: string;
  messages: ChatMessage[];
  updatedAt: number;
  lastReadAt: number;
}

interface ChatContextType {
  conversations: Conversation[];
  getOrCreateConversation: (listingId: string, listingTitle: string, otherUserName: string) => Conversation;
  sendMessage: (conversationId: string, text: string) => void;
  sendSpecialMessage: (conversationId: string, type: Exclude<MessageType, "text">) => void;
  markAsRead: (conversationId: string) => void;
  unreadCount: number;
}

const ChatContext = createContext<ChatContextType | null>(null);
const STORAGE_KEY = "@trampaj_chats_v3";

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) setConversations(JSON.parse(raw));
    });
  }, []);

  const save = useCallback((convs: Conversation[]) => {
    setConversations(convs);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(convs));
  }, []);

  const getOrCreateConversation = useCallback(
    (listingId: string, listingTitle: string, otherUserName: string) => {
      const existing = conversations.find((c) => c.listingId === listingId);
      if (existing) return existing;
      const now = Date.now();
      const newConv: Conversation = {
        id: now.toString(),
        listingId,
        listingTitle,
        otherUserName,
        lastReadAt: now,
        messages: [],
        updatedAt: now,
      };
      save([newConv, ...conversations]);
      return newConv;
    },
    [conversations, save]
  );

  const sendMessage = useCallback(
    (conversationId: string, text: string) => {
      const msg: ChatMessage = {
        id: Date.now().toString(),
        text,
        type: "text",
        fromMe: true,
        createdAt: Date.now(),
      };
      const updated = conversations.map((c) =>
        c.id !== conversationId
          ? c
          : { ...c, messages: [...c.messages, msg], updatedAt: Date.now(), lastReadAt: Date.now() }
      );
      save(updated);
    },
    [conversations, save]
  );

  const sendSpecialMessage = useCallback(
    (conversationId: string, type: Exclude<MessageType, "text">) => {
      const conv = conversations.find((c) => c.id === conversationId);
      const msg: ChatMessage = {
        id: Date.now().toString(),
        text: "",
        type,
        fromMe: true,
        createdAt: Date.now(),
      };
      const updated = conversations.map((c) =>
        c.id !== conversationId
          ? c
          : { ...c, messages: [...c.messages, msg], updatedAt: Date.now(), lastReadAt: Date.now() }
      );
      save(updated);

      // Simulacija: kad šalješ handshake_request, drugi korisnik ga prihvaća nakon 2.5s
      if (type === "handshake_request") {
        setTimeout(() => {
          const replyMsg: ChatMessage = {
            id: (Date.now() + 1).toString(),
            text: "",
            type: "handshake_accepted",
            fromMe: false,
            createdAt: Date.now(),
          };
          setConversations((prev) => {
            const next = prev.map((c) =>
              c.id === conversationId
                ? { ...c, messages: [...c.messages, replyMsg], updatedAt: Date.now() }
                : c
            );
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
          });
          if (AppState.currentState !== "active") {
            sendLocalNotification(
              conv?.otherUserName ?? "Trampaj",
              "Prihvatio/la je zaključivanje trampe! 🤝",
              { conversationId, listingId: conv?.listingId ?? "" }
            );
          }
        }, 2500);
      }
    },
    [conversations, save]
  );

  const markAsRead = useCallback((conversationId: string) => {
    setConversations((prev) => {
      const next = prev.map((c) =>
        c.id === conversationId ? { ...c, lastReadAt: Date.now() } : c
      );
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const unreadCount = conversations.reduce((total, c) => {
    const unread = c.messages.filter(
      (m) => !m.fromMe && m.createdAt > (c.lastReadAt ?? 0)
    ).length;
    return total + unread;
  }, 0);

  return (
    <ChatContext.Provider value={{ conversations, getOrCreateConversation, sendMessage, sendSpecialMessage, markAsRead, unreadCount }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
