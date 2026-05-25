import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { sendLocalNotification } from "@/utils/notifications";

export interface ChatMessage {
  id: string;
  text: string;
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
  markAsRead: (conversationId: string) => void;
  unreadCount: number;
}

const ChatContext = createContext<ChatContextType | null>(null);
const STORAGE_KEY = "@trampaj_chats_v2";

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
        lastReadAt: now + 2000,
        messages: [
          {
            id: "welcome",
            text: `Zdravo! Zainteresiran/a sam za "${listingTitle}". Možemo dogovoriti zamjenu?`,
            fromMe: true,
            createdAt: now - 1000,
          },
          {
            id: "reply",
            text: `Bok! Da, predmet je još dostupan. Što nudiš u zamjenu?`,
            fromMe: false,
            createdAt: now,
          },
        ],
        updatedAt: now,
      };
      save([newConv, ...conversations]);
      return newConv;
    },
    [conversations, save]
  );

  const sendMessage = useCallback(
    (conversationId: string, text: string) => {
      const conv = conversations.find((c) => c.id === conversationId);
      const updated = conversations.map((c) => {
        if (c.id !== conversationId) return c;
        const userMsg: ChatMessage = {
          id: Date.now().toString(),
          text,
          fromMe: true,
          createdAt: Date.now(),
        };
        return {
          ...c,
          messages: [...c.messages, userMsg],
          updatedAt: Date.now(),
          lastReadAt: Date.now(),
        };
      });
      save(updated);

      // Simulirani odgovor nakon 1.5s
      setTimeout(() => {
        const replies = [
          "Zvuči dobro! Kada bi mogao/mogla?",
          "Može, javi se na broj ili dogovorimo uživo.",
          "Odlično! Imam isto nešto slično, pogledaj moje oglase.",
          "Super! Gdje si smješten/a?",
          "Hmm, razmislit ću — možeš li malo opisati stanje?",
        ];
        const replyText = replies[Math.floor(Math.random() * replies.length)];
        const replyMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          text: replyText,
          fromMe: false,
          createdAt: Date.now() + 1500,
        };

        setConversations((prev) => {
          const next = prev.map((c) =>
            c.id === conversationId
              ? { ...c, messages: [...c.messages, replyMsg], updatedAt: Date.now() + 1500 }
              : c
          );
          AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          return next;
        });

        // Pošalji lokalnu notifikaciju ako app nije u fokusu
        if (AppState.currentState !== "active") {
          sendLocalNotification(
            conv?.otherUserName ?? "Trampaj",
            replyText,
            { conversationId, listingId: conv?.listingId ?? "" }
          );
        }
      }, 1500);
    },
    [conversations, save]
  );

  const markAsRead = useCallback(
    (conversationId: string) => {
      setConversations((prev) => {
        const next = prev.map((c) =>
          c.id === conversationId ? { ...c, lastReadAt: Date.now() } : c
        );
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const unreadCount = conversations.reduce((total, c) => {
    const unread = c.messages.filter(
      (m) => !m.fromMe && m.createdAt > (c.lastReadAt ?? 0)
    ).length;
    return total + unread;
  }, 0);

  return (
    <ChatContext.Provider value={{ conversations, getOrCreateConversation, sendMessage, markAsRead, unreadCount }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
