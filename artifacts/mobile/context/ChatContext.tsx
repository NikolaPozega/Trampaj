import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

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
}

interface ChatContextType {
  conversations: Conversation[];
  getOrCreateConversation: (listingId: string, listingTitle: string, otherUserName: string) => Conversation;
  sendMessage: (conversationId: string, text: string) => void;
  unreadCount: number;
}

const ChatContext = createContext<ChatContextType | null>(null);
const STORAGE_KEY = "@trampaj_chats";

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
      const newConv: Conversation = {
        id: Date.now().toString(),
        listingId,
        listingTitle,
        otherUserName,
        messages: [
          {
            id: "welcome",
            text: `Zdravo! Zainteresiran/a sam za "${listingTitle}". Možemo dogovoriti zamjenu?`,
            fromMe: true,
            createdAt: Date.now() - 1000,
          },
          {
            id: "reply",
            text: `Bok! Da, predmet je još dostupan. Što nudiš u zamjenu?`,
            fromMe: false,
            createdAt: Date.now(),
          },
        ],
        updatedAt: Date.now(),
      };
      save([newConv, ...conversations]);
      return newConv;
    },
    [conversations, save]
  );

  const sendMessage = useCallback(
    (conversationId: string, text: string) => {
      const updated = conversations.map((c) => {
        if (c.id !== conversationId) return c;
        const userMsg: ChatMessage = {
          id: Date.now().toString(),
          text,
          fromMe: true,
          createdAt: Date.now(),
        };
        // Simulate reply after 1.5s
        setTimeout(() => {
          const replies = [
            "Zvuči dobro! Kada bi mogao/mogla?",
            "Može, javi se na broj ili dogovorimo uživo.",
            "Odlično! Imam isto nešto slično, pogledaj moje oglase.",
            "Super! Gdje si smješten/a?",
          ];
          const reply: ChatMessage = {
            id: (Date.now() + 1).toString(),
            text: replies[Math.floor(Math.random() * replies.length)],
            fromMe: false,
            createdAt: Date.now() + 1500,
          };
          setConversations((prev) => {
            const next = prev.map((conv) =>
              conv.id === conversationId
                ? { ...conv, messages: [...conv.messages, reply], updatedAt: Date.now() + 1500 }
                : conv
            );
            AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
          });
        }, 1500);

        return {
          ...c,
          messages: [...c.messages, userMsg],
          updatedAt: Date.now(),
        };
      });
      save(updated);
    },
    [conversations, save]
  );

  const unreadCount = 0;

  return (
    <ChatContext.Provider value={{ conversations, getOrCreateConversation, sendMessage, unreadCount }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
