import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "./AuthContext";

export const CATEGORIES = [
  "Sve",
  "Elektronika",
  "Odjeća",
  "Knjige",
  "Sport",
  "Nakit",
  "Namještaj",
  "Igračke",
  "Ostalo",
];

export const CONDITIONS = [
  "Kao novo",
  "Jako dobro",
  "Dobro",
  "Prihvatljivo",
] as const;
export type Condition = (typeof CONDITIONS)[number];

export const CONDITION_COLORS: Record<Condition, string> = {
  "Kao novo": "#38BDF8",
  "Jako dobro": "#4ADE80",
  "Dobro": "#FACC15",
  "Prihvatljivo": "#FB923C",
};

export type Topup = "primam" | "dajem" | "oboje" | "ne";
export type Flexibility = "tocno" | "otvoren";
export type Deadline = "hitno" | "ovaj-mjesec" | "bez-roka";
export type PackageSize = "small" | "medium" | "large";
export type PackageBoxSize = "S" | "M" | "L";

export interface Listing {
  id: string;
  userId?: string;
  title: string;
  description: string;
  category: string;
  condition: Condition | null;
  wantedFor: string;
  price: number | null;
  imageUris: string[];
  imageUri?: string | null;
  phone: string | null;
  userName: string;
  location: string;
  createdAt: number;
  status: "active" | "traded";
  moderationStatus?: "pending" | "active" | "rejected";
  isMine: boolean;
  topup?: Topup | null;
  flexibility?: Flexibility | null;
  cashFallback?: boolean | null;
  deadline?: Deadline | null;
  nudimTags?: string[];
  trazimTags?: string[];
  packageSize?: PackageSize | null;
  packageBoxSize?: PackageBoxSize | null;
  packageWeight?: number | null;
}

export interface Review {
  id: string;
  targetUserName: string;
  authorName: string;
  stars: number;
  comment: string;
  createdAt: number;
}

interface ListingsContextType {
  listings: Listing[];
  myListings: Listing[];
  myName: string;
  setMyName: (name: string) => void;
  addListing: (listing: Omit<Listing, "id" | "createdAt" | "status" | "isMine" | "userName">) => Promise<{ ok: boolean; error?: string }>;
  updateListing: (id: string, updates: Partial<Pick<Listing, "title" | "description" | "wantedFor" | "price" | "category" | "location" | "condition" | "topup" | "flexibility" | "cashFallback" | "deadline" | "nudimTags" | "trazimTags">>) => void;
  markAsTraded: (id: string) => void;
  markAsActive: (id: string) => void;
  deleteListing: (id: string) => void;
  savedListingIds: string[];
  saveListing: (id: string) => void;
  unsaveListing: (id: string) => void;
  reviews: Review[];
  addReview: (targetUserName: string, stars: number, comment: string) => void;
  deleteAllData: () => Promise<void>;
  isLoaded: boolean;
  blockedUserNames: string[];
  blockUser: (userName: string) => void;
  unblockUser: (userName: string) => void;
  refreshListings: () => Promise<void>;
  refreshMyListings: () => Promise<void>;
  bumpListing: (id: string) => Promise<boolean>;
  serverMatchResults: Array<{ myListingId: string; theirListingId: string; matchType: "both" | "i_want" | "they_want"; score: number }>;
  fetchSemanticMatches: (dismissedIds?: string[]) => Promise<void>;
  matchesLoading: boolean;
}

const ListingsContext = createContext<ListingsContextType | null>(null);

const FALLBACK_DOMAIN = "trampaj.hr";
const API_BASE = `https://${process.env["EXPO_PUBLIC_DOMAIN"] ?? FALLBACK_DOMAIN}/api`;

// ─── Sample listings (shown when not connected / API empty) ──────────────────
const SAMPLE_LISTINGS: Listing[] = [];

// ─── Provider ────────────────────────────────────────────────────────────────
export function ListingsProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [savedListingIds, setSavedListingIds] = useState<string[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [blockedUserNames, setBlockedUserNames] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [serverMatchResults, setServerMatchResults] = useState<Array<{ myListingId: string; theirListingId: string; matchType: "both" | "i_want" | "they_want"; score: number }>>([]);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const myName = user?.username ?? "Korisnik";

  // ─── Helpers ───────────────────────────────────────────────────────────────
  const authHeaders = useCallback((): Record<string, string> => {
    const t = tokenRef.current;
    return t ? { Authorization: `Bearer ${t}`, "Content-Type": "application/json" } : { "Content-Type": "application/json" };
  }, []);

  // ─── Fetch MY listings (all statuses, including pending moderation) ─────────
  const refreshMyListings = useCallback(async () => {
    if (!user?.username) { setMyListings([]); return; }
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${API_BASE}/listings/by-user/${encodeURIComponent(user.username)}`, {
        headers: authHeaders(),
        signal: controller.signal,
      });
      clearTimeout(tid);
      if (res.ok) {
        const data = await res.json() as { listings?: Listing[] };
        const rows = Array.isArray(data.listings) ? data.listings : [];
        setMyListings(rows.map((l) => ({
          ...l,
          isMine: true,
          imageUris: Array.isArray(l.imageUris) ? l.imageUris.filter((u) => typeof u === "string" && u.startsWith("http")) : [],
          nudimTags: Array.isArray(l.nudimTags) ? l.nudimTags : [],
          trazimTags: Array.isArray(l.trazimTags) ? l.trazimTags : [],
        })));
      }
    } catch { /* offline */ }
  }, [user?.username, authHeaders]);

  // ─── Fetch listings from API ───────────────────────────────────────────────
  const refreshListings = useCallback(async () => {
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${API_BASE}/listings`, { headers: authHeaders(), signal: controller.signal });
      clearTimeout(tid);
      if (res.ok) {
        const data = await res.json() as { listings?: Listing[] };
        const rows = Array.isArray(data.listings) ? data.listings : [];
        setListings(rows.map((l) => ({
          ...l,
          imageUris: Array.isArray(l.imageUris) ? l.imageUris.filter((u) => typeof u === "string" && u.startsWith("http")) : [],
          nudimTags: Array.isArray(l.nudimTags) ? l.nudimTags : [],
          trazimTags: Array.isArray(l.trazimTags) ? l.trazimTags : [],
        })));
        return;
      }
    } catch { /* offline or timeout */ }
    // Keep existing listings on error (don't replace with samples)
  }, [authHeaders]);

  // ─── Load saved IDs from API ───────────────────────────────────────────────
  const loadSaved = useCallback(async () => {
    if (!tokenRef.current) { setSavedListingIds([]); return; }
    try {
      const res = await fetch(`${API_BASE}/saved`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json() as { savedIds: string[] };
        setSavedListingIds(data.savedIds);
      }
    } catch { /* ignore */ }
  }, [authHeaders]);

  // ─── Load blocked from API ─────────────────────────────────────────────────
  const loadBlocked = useCallback(async () => {
    if (!tokenRef.current) { setBlockedUserNames([]); return; }
    try {
      const res = await fetch(`${API_BASE}/blocked`, { headers: authHeaders() });
      if (res.ok) {
        const data = await res.json() as { blockedUserNames: string[] };
        setBlockedUserNames(data.blockedUserNames);
      }
    } catch { /* ignore */ }
  }, [authHeaders]);

  // ─── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    setIsLoaded(false);
    Promise.all([refreshListings(), refreshMyListings(), loadSaved(), loadBlocked()]).finally(() => {
      setIsLoaded(true);
    });
  }, [user?.id]); // re-run when user changes (login/logout)

  // ─── CRUD operations ───────────────────────────────────────────────────────
  const addListing = useCallback(
    async (data: Omit<Listing, "id" | "createdAt" | "status" | "isMine" | "userName">): Promise<{ ok: boolean; error?: string }> => {
      if (!tokenRef.current) return { ok: false, error: "Nisi prijavljen" };
      try {
        const r = await fetch(`${API_BASE}/listings`, {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify(data),
        });
        if (r.ok) {
          // Refresh in background — don't block success response
          void Promise.all([refreshListings(), refreshMyListings()]);
          return { ok: true };
        }
        const body = await r.json().catch(() => ({})) as { error?: string };
        return { ok: false, error: body.error ?? `Greška (${r.status})` };
      } catch {
        return { ok: false, error: "Provjeri vezu i pokušaj ponovo" };
      }
    },
    [authHeaders, refreshListings, refreshMyListings]
  );

  const updateListing = useCallback(
    (id: string, updates: Partial<Pick<Listing, "title" | "description" | "wantedFor" | "price" | "category" | "location" | "condition" | "topup" | "flexibility" | "cashFallback" | "deadline" | "nudimTags" | "trazimTags">>) => {
      if (!tokenRef.current) return;
      // Optimistic update
      setListings((prev) => prev.map((l) => (l.id === id ? { ...l, ...updates } : l)));
      fetch(`${API_BASE}/listings/${id}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify(updates),
      }).catch(() => {});
    },
    [authHeaders]
  );

  const markAsTraded = useCallback((id: string) => {
    setListings((prev) => prev.map((l) => (l.id === id ? { ...l, status: "traded" as const } : l)));
    setMyListings((prev) => prev.map((l) => (l.id === id ? { ...l, status: "traded" as const } : l)));
    fetch(`${API_BASE}/listings/${id}/status`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ status: "traded" }),
    }).catch(() => {});
  }, [authHeaders]);

  const markAsActive = useCallback((id: string) => {
    setListings((prev) => prev.map((l) => (l.id === id ? { ...l, status: "active" as const } : l)));
    setMyListings((prev) => prev.map((l) => (l.id === id ? { ...l, status: "active" as const } : l)));
    fetch(`${API_BASE}/listings/${id}/status`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify({ status: "active" }),
    }).catch(() => {});
  }, [authHeaders]);

  const deleteListing = useCallback((id: string) => {
    setListings((prev) => prev.filter((l) => l.id !== id));
    setMyListings((prev) => prev.filter((l) => l.id !== id));
    fetch(`${API_BASE}/listings/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).catch(() => {});
  }, [authHeaders]);

  const saveListing = useCallback((id: string) => {
    setSavedListingIds((prev) => prev.includes(id) ? prev : [...prev, id]);
    fetch(`${API_BASE}/saved/${id}`, { method: "POST", headers: authHeaders() }).catch(() => {});
  }, [authHeaders]);

  const unsaveListing = useCallback((id: string) => {
    setSavedListingIds((prev) => prev.filter((s) => s !== id));
    fetch(`${API_BASE}/saved/${id}`, { method: "DELETE", headers: authHeaders() }).catch(() => {});
  }, [authHeaders]);

  const addReview = useCallback((targetUserName: string, stars: number, comment: string) => {
    const review: Review = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 8),
      targetUserName,
      authorName: myName,
      stars,
      comment: comment.trim(),
      createdAt: Date.now(),
    };
    setReviews((prev) => [review, ...prev]);
    fetch(`${API_BASE}/reviews`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ targetUserName, stars, comment }),
    }).catch(() => {});
  }, [myName, authHeaders]);

  const blockUser = useCallback((userName: string) => {
    setBlockedUserNames((prev) => prev.includes(userName) ? prev : [...prev, userName]);
    fetch(`${API_BASE}/blocked`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ username: userName }),
    }).catch(() => {});
  }, [authHeaders]);

  const unblockUser = useCallback((userName: string) => {
    setBlockedUserNames((prev) => prev.filter((u) => u !== userName));
    fetch(`${API_BASE}/blocked/${encodeURIComponent(userName)}`, {
      method: "DELETE",
      headers: authHeaders(),
    }).catch(() => {});
  }, [authHeaders]);

  const bumpListing = useCallback(async (id: string): Promise<boolean> => {
    if (!tokenRef.current) return false;
    try {
      const res = await fetch(`${API_BASE}/listings/${id}/bump`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (res.ok) {
        // Lokalno osvježi updatedAt na NOW
        setMyListings((prev) => prev.map((l) => l.id === id ? { ...l, createdAt: Date.now() } : l));
        return true;
      }
    } catch { /* offline */ }
    return false;
  }, [authHeaders]);

  const fetchSemanticMatches = useCallback(async (dismissedIds: string[] = []) => {
    if (!tokenRef.current) return;
    setMatchesLoading(true);
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(`${API_BASE}/listings/semantic-matches`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({ dismissedIds }),
        signal: controller.signal,
      });
      clearTimeout(tid);
      if (res.ok) {
        const data = await res.json() as { matches: Array<{ myListingId: string; theirListingId: string; matchType: "both" | "i_want" | "they_want"; score: number }> };
        setServerMatchResults(data.matches ?? []);
      }
    } catch { /* offline or timeout */ }
    finally { setMatchesLoading(false); }
  }, [authHeaders]);

  const setMyName = useCallback((_name: string) => {
    // Username is managed via auth profile — this is a no-op kept for interface compat
  }, []);

  const deleteAllData = useCallback(async () => {
    await AsyncStorage.multiRemove([
      "@trampaj_listings_v3",
      "@trampaj_name",
      "@trampaj_saved_v1",
      "@trampaj_reviews_v1",
      "@trampaj_blocked_v1",
      "@trampaj_onboarded_v1",
      "@trampaj_chats_v5",
    ]);
    setListings([]);
    setSavedListingIds([]);
    setReviews([]);
    setBlockedUserNames([]);
  }, []);

  return (
    <ListingsContext.Provider
      value={{
        listings,
        myListings,
        myName,
        setMyName,
        addListing,
        updateListing,
        markAsTraded,
        markAsActive,
        deleteListing,
        savedListingIds,
        saveListing,
        unsaveListing,
        reviews,
        addReview,
        deleteAllData,
        isLoaded,
        blockedUserNames,
        blockUser,
        unblockUser,
        refreshListings,
        refreshMyListings,
        bumpListing,
        serverMatchResults,
        fetchSemanticMatches,
        matchesLoading,
      }}
    >
      {children}
    </ListingsContext.Provider>
  );
}

export function useListings() {
  const ctx = useContext(ListingsContext);
  if (!ctx) throw new Error("useListings must be used within ListingsProvider");
  return ctx;
}
