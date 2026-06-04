import { AppState } from "react-native";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";
import { sendLocalNotification } from "@/utils/notifications";

export type MessageType = "text" | "handshake_request" | "handshake_accepted" | "handshake_rejected" | "delivery_personal" | "delivery_courier";

export interface ChatMessage {
  id: string;
  text: string;
  type: MessageType;
  fromMe: boolean;
  createdAt: number;
}

export interface DeliveryInfo {
  method: "courier" | "personal";
  escrowActive: boolean;
}

export interface EscrowStatus {
  myStatus: "none" | "pending" | "held" | "confirmed" | "released" | "captured";
  theirStatus: "none" | "pending" | "held" | "confirmed" | "released" | "captured";
  myCheckoutSessionId?: string | null;
  bothHeld: boolean;
  bothConfirmed: boolean;
  released: boolean;
  myAmount: number;
  theirAmount: number;
  currency: string;
}

export interface Conversation {
  id: string;
  listingId: string;
  listingTitle: string;
  otherUserName: string;
  messages: ChatMessage[];
  updatedAt: number;
  lastReadAt: number;
  dealShown: boolean;
  disclaimerAccepted?: boolean;
  deliveryInfo?: DeliveryInfo;
  escrowStatus?: EscrowStatus;
}

interface ChatContextType {
  conversations: Conversation[];
  refreshConversations: () => Promise<void>;
  getOrCreateConversation: (listingId: string, listingTitle: string, otherUserName: string) => Promise<Conversation | null>;
  sendMessage: (conversationId: string, text: string) => Promise<void>;
  sendSpecialMessage: (conversationId: string, type: Exclude<MessageType, "text">) => Promise<void>;
  markAsRead: (conversationId: string) => void;
  markDealShown: (conversationId: string) => void;
  acceptDisclaimer: (conversationId: string) => void;
  saveDeliveryInfo: (conversationId: string, info: DeliveryInfo) => void;
  deleteConversation: (conversationId: string) => void;
  loadEscrowStatus: (conversationId: string) => Promise<void>;
  confirmReceipt: (conversationId: string) => Promise<{ bothConfirmed: boolean; released: boolean }>;
  unreadCount: number;
}

const ChatContext = createContext<ChatContextType | null>(null);

const FALLBACK_DOMAIN = "trampaj.hr";
const API_BASE = `https://${process.env["EXPO_PUBLIC_DOMAIN"] ?? FALLBACK_DOMAIN}/api`;

const POLL_INTERVAL = 5000;

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef(AppState.currentState);

  const authHeaders = useCallback((): Record<string, string> => {
    const t = tokenRef.current;
    return t ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
  }, []);

  // ─── Fetch all conversations from API ─────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    if (!tokenRef.current) return;
    try {
      const res = await fetch(`${API_BASE}/conversations`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json() as { conversations?: Conversation[] };
      const incoming = Array.isArray(data?.conversations) ? data.conversations : [];

      // ── Izračunaj nove poruke za notifikacije IZVAN updatera (updater mora biti čist) ──
      const toNotify: { otherUserName: string; text: string; listingId: string; conversationId: string }[] = [];

      setConversations((prev) => {
        const incomingIds = new Set(incoming.map((c) => c.id));

        const merged = incoming.map((conv) => {
          const msgs = Array.isArray(conv.messages) ? conv.messages : [];
          const existing = prev.find((c) => c.id === conv.id);
          if (!existing) return { ...conv, messages: msgs };

          const prevMsgs = Array.isArray(existing.messages) ? existing.messages : [];
          const prevCount = prevMsgs.filter((m) => !m.fromMe).length;
          const newCount = msgs.filter((m) => !m.fromMe).length;
          if (newCount > prevCount && AppState.currentState !== "active") {
            msgs.filter((m) => !m.fromMe).slice(prevCount).forEach((m) => {
              toNotify.push({
                otherUserName: conv.otherUserName,
                text: m.type === "text" ? m.text : "Poslao/la je zahtjev za dogovor",
                listingId: conv.listingId,
                conversationId: conv.id,
              });
            });
          }

          // Spoji: server poruke + lokalni temp_ koje server još ne zna
          const serverIds = new Set(msgs.map((m) => m.id));
          const pendingLocal = prevMsgs.filter((m) => m.id.startsWith("temp_") && !serverIds.has(m.id));
          const mergedMsgs = pendingLocal.length > 0 ? [...msgs, ...pendingLocal] : msgs;

          return {
            ...conv,
            messages: mergedMsgs,
            dealShown: conv.dealShown || existing.dealShown,
            escrowStatus: existing.escrowStatus ?? conv.escrowStatus,
          };
        });

        // Zadrži lokalne konverzacije koje server još ne poznaje (race condition pri kreiranju)
        const localOnly = prev.filter((p) => !incomingIds.has(p.id));
        return localOnly.length > 0 ? [...localOnly, ...merged] : merged;
      });

      // Šalji lokalne notifikacije NAKON što je state ažuriran
      toNotify.forEach(({ otherUserName, text, listingId, conversationId }) => {
        sendLocalNotification(otherUserName, text, { listingId, conversationId });
      });
    } catch { /* offline */ }
  }, [authHeaders]);

  // ─── Polling ───────────────────────────────────────────────────────────────
  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(() => {
      if (appStateRef.current === "active" && tokenRef.current) {
        fetchConversations();
      }
    }, POLL_INTERVAL);
  }, [fetchConversations]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (token) {
      fetchConversations();
      startPolling();
    } else {
      setConversations([]);
      stopPolling();
    }
    return stopPolling;
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      appStateRef.current = state;
      if (state === "active" && token) {
        fetchConversations();
      }
    });
    return () => sub.remove();
  }, [fetchConversations, token]);

  // ─── Get or create conversation ───────────────────────────────────────────
  const getOrCreateConversation = useCallback(
    async (listingId: string, _listingTitle: string, _otherUserName: string): Promise<Conversation | null> => {
      if (!tokenRef.current) return null;

      const cached = conversations.find((c) => c.listingId === listingId);
      if (cached) return cached;

      try {
        const res = await fetch(`${API_BASE}/conversations`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ listingId }),
        });
        if (!res.ok) return null;
        const data = await res.json() as { conversation: Conversation };
        const conv = data.conversation;
        setConversations((prev) => {
          const exists = prev.find((c) => c.id === conv.id);
          return exists ? prev.map((c) => c.id === conv.id ? conv : c) : [conv, ...prev];
        });
        return conv;
      } catch {
        return null;
      }
    },
    [conversations, authHeaders]
  );

  // ─── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (conversationId: string, text: string): Promise<void> => {
    if (!tokenRef.current) return;
    const tempMsg: ChatMessage = {
      id: `temp_${Date.now()}`,
      text,
      type: "text",
      fromMe: true,
      createdAt: Date.now(),
    };
    setConversations((prev) =>
      prev.map((c) =>
        c.id !== conversationId ? c
          : { ...c, messages: [...c.messages, tempMsg], updatedAt: Date.now(), lastReadAt: Date.now() }
      )
    );

    try {
      const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ text, type: "text" }),
      });
      if (res.ok) {
        const data = await res.json() as { message: ChatMessage };
        setConversations((prev) =>
          prev.map((c) =>
            c.id !== conversationId ? c
              : {
                  ...c,
                  messages: c.messages.map((m) => m.id === tempMsg.id ? data.message : m),
                  updatedAt: Date.now(),
                  lastReadAt: Date.now(),
                }
          )
        );
      }
    } catch { /* keep optimistic */ }
  }, [authHeaders]);

  // ─── Send special message ─────────────────────────────────────────────────
  const sendSpecialMessage = useCallback(
    async (conversationId: string, type: Exclude<MessageType, "text">): Promise<void> => {
      if (!tokenRef.current) return;
      const tempMsg: ChatMessage = {
        id: `temp_${Date.now()}`,
        text: "",
        type,
        fromMe: true,
        createdAt: Date.now(),
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.id !== conversationId ? c
            : { ...c, messages: [...c.messages, tempMsg], updatedAt: Date.now(), lastReadAt: Date.now() }
        )
      );

      try {
        const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({ text: "", type }),
        });
        if (res.ok) {
          const data = await res.json() as { message: ChatMessage };
          setConversations((prev) =>
            prev.map((c) =>
              c.id !== conversationId ? c
                : {
                    ...c,
                    messages: c.messages.map((m) => m.id === tempMsg.id ? data.message : m),
                    updatedAt: Date.now(),
                    lastReadAt: Date.now(),
                  }
            )
          );
        }
      } catch { /* keep optimistic */ }
    },
    [authHeaders]
  );

  // ─── Mark as read ─────────────────────────────────────────────────────────
  const markAsRead = useCallback((conversationId: string) => {
    const now = Date.now();
    setConversations((prev) =>
      prev.map((c) => c.id === conversationId ? { ...c, lastReadAt: now } : c)
    );
    fetch(`${API_BASE}/conversations/${conversationId}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ markAsRead: true }),
    }).catch(() => {});
  }, [authHeaders]);

  // ─── Mark deal shown ──────────────────────────────────────────────────────
  const markDealShown = useCallback((conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) => c.id === conversationId ? { ...c, dealShown: true } : c)
    );
    fetch(`${API_BASE}/conversations/${conversationId}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ dealShown: true }),
    }).catch(() => {});
  }, [authHeaders]);

  // ─── Accept disclaimer ────────────────────────────────────────────────────
  const acceptDisclaimer = useCallback((conversationId: string) => {
    setConversations((prev) =>
      prev.map((c) => c.id === conversationId ? { ...c, disclaimerAccepted: true } : c)
    );
    fetch(`${API_BASE}/conversations/${conversationId}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ disclaimerAccepted: true }),
    }).catch(() => {});
  }, [authHeaders]);

  // ─── Save delivery info ───────────────────────────────────────────────────
  const saveDeliveryInfo = useCallback((conversationId: string, info: DeliveryInfo) => {
    setConversations((prev) =>
      prev.map((c) => c.id === conversationId ? { ...c, deliveryInfo: info } : c)
    );
    fetch(`${API_BASE}/conversations/${conversationId}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ deliveryMethod: info.method, escrowActive: info.escrowActive }),
    }).catch(() => {});
  }, [authHeaders]);

  // ─── Load escrow status ───────────────────────────────────────────────────
  const loadEscrowStatus = useCallback(async (conversationId: string) => {
    if (!tokenRef.current) return;
    try {
      const res = await fetch(`${API_BASE}/escrow/status/${conversationId}`, {
        headers: authHeaders(),
      });
      if (!res.ok) return;
      const status = await res.json() as EscrowStatus;
      setConversations((prev) =>
        prev.map((c) => c.id === conversationId ? { ...c, escrowStatus: status } : c)
      );
    } catch { /* offline */ }
  }, [authHeaders]);

  // ─── Confirm receipt ──────────────────────────────────────────────────────
  const confirmReceipt = useCallback(async (conversationId: string): Promise<{ bothConfirmed: boolean; released: boolean }> => {
    if (!tokenRef.current) return { bothConfirmed: false, released: false };
    try {
      const res = await fetch(`${API_BASE}/escrow/confirm/${conversationId}`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error("Failed");
      const result = await res.json() as {
        myStatus: EscrowStatus["myStatus"];
        theirStatus: EscrowStatus["theirStatus"];
        bothConfirmed: boolean;
        released: boolean;
      };
      // Update local escrow status
      setConversations((prev) =>
        prev.map((c) => c.id !== conversationId ? c : {
          ...c,
          escrowStatus: {
            ...c.escrowStatus,
            myStatus: result.myStatus,
            theirStatus: result.theirStatus,
            bothConfirmed: result.bothConfirmed,
            released: result.released,
            bothHeld: c.escrowStatus?.bothHeld ?? false,
            myAmount: c.escrowStatus?.myAmount ?? 0,
            theirAmount: c.escrowStatus?.theirAmount ?? 0,
            currency: c.escrowStatus?.currency ?? "eur",
          },
        })
      );
      return { bothConfirmed: result.bothConfirmed, released: result.released };
    } catch {
      return { bothConfirmed: false, released: false };
    }
  }, [authHeaders]);

  // ─── Delete conversation ───────────────────────────────────────────────────
  const deleteConversation = useCallback((conversationId: string) => {
    // Optimistično ukloni odmah — polling ne smije vratiti obrisano
    setConversations((prev) => prev.filter((c) => c.id !== conversationId));
    // Obriši i na serveru (CASCADE briše poruke + escrow)
    fetch(`${API_BASE}/conversations/${conversationId}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).catch(() => {/* offline — lokalno brisanje je dovoljno */});
  }, [authHeaders]);

  // ─── Unread count ──────────────────────────────────────────────────────────
  const unreadCount = conversations.reduce((total, c) => {
    const unread = c.messages.filter(
      (m) => !m.fromMe && m.createdAt > (c.lastReadAt ?? 0)
    ).length;
    return total + unread;
  }, 0);

  return (
    <ChatContext.Provider value={{
      conversations,
      refreshConversations: fetchConversations,
      getOrCreateConversation,
      sendMessage,
      sendSpecialMessage,
      markAsRead,
      markDealShown,
      acceptDisclaimer,
      saveDeliveryInfo,
      loadEscrowStatus,
      confirmReceipt,
      deleteConversation,
      unreadCount,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
