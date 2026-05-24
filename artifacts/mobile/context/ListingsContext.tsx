import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

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

export interface Listing {
  id: string;
  title: string;
  description: string;
  category: string;
  condition: Condition | null;
  wantedFor: string;
  price: number | null;
  imageUri: string | null;
  phone: string | null;
  userName: string;
  location: string;
  createdAt: number;
  status: "active" | "traded";
  isMine: boolean;
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
  myName: string;
  setMyName: (name: string) => void;
  addListing: (listing: Omit<Listing, "id" | "createdAt" | "status" | "isMine" | "userName">) => void;
  updateListing: (id: string, updates: Partial<Pick<Listing, "title" | "description" | "wantedFor" | "price" | "category" | "location" | "condition">>) => void;
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
}

const ListingsContext = createContext<ListingsContextType | null>(null);

const STORAGE_KEY = "@trampaj_listings_v2";
const NAME_KEY = "@trampaj_name";
const SAVED_KEY = "@trampaj_saved_v1";
const REVIEWS_KEY = "@trampaj_reviews_v1";

const SAMPLE_LISTINGS: Listing[] = [
  {
    id: "sample_1",
    title: "Sony slušalice WH-1000XM4",
    description: "Odlične slušalice s redukcijom buke, malo korištene. U originalnoj kutiji, sve ispravno radi.",
    category: "Elektronika",
    condition: "Jako dobro",
    wantedFor: "Bežična tipkovnica ili miš visokog kvaliteta",
    price: 180,
    imageUri: "https://picsum.photos/seed/headphones1/400/300",
    phone: "091 123 4567",
    userName: "Marko K.",
    location: "Zagreb",
    createdAt: Date.now() - 86400000 * 2,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_2",
    title: "Zimska jakna XL, North Face",
    description: "Topla zimska jakna, nosio je jednu sezonu. Boja tamno plava, odlično stanje.",
    category: "Odjeća",
    condition: "Jako dobro",
    wantedFor: "Ljetna jakna ili sportska oprema",
    price: null,
    imageUri: "https://picsum.photos/seed/jacket2/400/300",
    phone: null,
    userName: "Ana P.",
    location: "Split",
    createdAt: Date.now() - 86400000 * 5,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_3",
    title: "Skup knjiga - fantazija (10 knjiga)",
    description: "Komplet knjiga Patricka Rothfussa i Brandona Sandersona. Sve u odličnom stanju.",
    category: "Knjige",
    condition: "Kao novo",
    wantedFor: "Sci-fi knjige ili stripovi",
    price: 60,
    imageUri: "https://picsum.photos/seed/books3/400/300",
    phone: "095 765 4321",
    userName: "Luka B.",
    location: "Rijeka",
    createdAt: Date.now() - 86400000 * 1,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_4",
    title: "Bicikl - gradski, 26\"",
    description: "Gradski bicikl, servisiran prošle godine. Nova guma naprijed. Boja srebrna.",
    category: "Sport",
    condition: "Dobro",
    wantedFor: "Roleri ili električni romobil",
    price: 350,
    imageUri: "https://picsum.photos/seed/bicycle4/400/300",
    phone: "098 111 2233",
    userName: "Petra M.",
    location: "Osijek",
    createdAt: Date.now() - 86400000 * 3,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_5",
    title: "Stolna lampa - industrijski stil",
    description: "Metalna lampa, crna boja, LED žarulja uključena. Idealna za radni stol.",
    category: "Namještaj",
    condition: "Dobro",
    wantedFor: "Polica za knjige ili mali stol",
    price: null,
    imageUri: "https://picsum.photos/seed/lamp5/400/300",
    phone: null,
    userName: "Tomislav R.",
    location: "Zagreb",
    createdAt: Date.now() - 86400000 * 7,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_6",
    title: "Roleri Rollerblade, vel. 42",
    description: "Inline roleri u odličnom stanju, korišteni svega par puta. Kaciga uključena.",
    category: "Sport",
    condition: "Kao novo",
    wantedFor: "Bicikl gradski ili električni romobil",
    price: 120,
    imageUri: "https://picsum.photos/seed/skates6/400/300",
    phone: "091 555 7788",
    userName: "Ivan S.",
    location: "Zagreb",
    createdAt: Date.now() - 86400000 * 2,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_7",
    title: "Bežični miš Logitech MX Master 3",
    description: "Premium miš, ergonomski, savršen za dugotrajni rad. Baterija traje 70 dana.",
    category: "Elektronika",
    condition: "Jako dobro",
    wantedFor: "Mehanička tipkovnica ili slušalice",
    price: 90,
    imageUri: "https://picsum.photos/seed/mouse7/400/300",
    phone: null,
    userName: "Dora V.",
    location: "Zagreb",
    createdAt: Date.now() - 86400000 * 1,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_8",
    title: "Ljetna jakna, H&M, M veličina",
    description: "Lagana ljetna jakna, nošena jednu sezonu. Boja krem/bijela, odlično stanje.",
    category: "Odjeća",
    condition: "Prihvatljivo",
    wantedFor: "Zimska jakna ili kaput",
    price: null,
    imageUri: "https://picsum.photos/seed/jacket8/400/300",
    phone: "092 333 1122",
    userName: "Maja L.",
    location: "Split",
    createdAt: Date.now() - 86400000 * 4,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_mine_1",
    title: "Gaming tipkovnica mehanička Logitech G413",
    description: "Mehanička tipkovnica s RGB osvjetljenjem, odlična za gaming i tipkanje. Malo korištena.",
    category: "Elektronika",
    condition: "Jako dobro",
    wantedFor: "Slušalice ili bežični miš",
    price: 150,
    imageUri: "https://picsum.photos/seed/keyboard9/400/300",
    phone: "098 000 1234",
    userName: "Korisnik",
    location: "Zagreb",
    createdAt: Date.now() - 86400000 * 1,
    status: "active",
    isMine: true,
  },
  {
    id: "sample_mine_2",
    title: "Brdski bicikl 29\", 21 brzina",
    description: "Solid brdski bicikl za rekreativce, servisiran ove godine. Shimano mjenjač.",
    category: "Sport",
    condition: "Dobro",
    wantedFor: "Roleri ili električni romobil",
    price: 280,
    imageUri: "https://picsum.photos/seed/mtb10/400/300",
    phone: "098 000 1234",
    userName: "Korisnik",
    location: "Zagreb",
    createdAt: Date.now() - 86400000 * 2,
    status: "active",
    isMine: true,
  },
  {
    id: "sample_mine_3",
    title: "Sci-fi knjige (5 komada)",
    description: "Asimov, Philip K. Dick i Arthur C. Clarke. Sve u odličnom stanju, bez oštećenja.",
    category: "Knjige",
    condition: "Kao novo",
    wantedFor: "Fantazija ili kriminalistički romani",
    price: 40,
    imageUri: "https://picsum.photos/seed/scifi11/400/300",
    phone: "098 000 1234",
    userName: "Korisnik",
    location: "Zagreb",
    createdAt: Date.now() - 86400000 * 3,
    status: "active",
    isMine: true,
  },
];

export function ListingsProvider({ children }: { children: React.ReactNode }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [myName, setMyNameState] = useState<string>("Korisnik");
  const [savedListingIds, setSavedListingIds] = useState<string[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [storedListings, storedName, storedSaved, storedReviews] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(NAME_KEY),
          AsyncStorage.getItem(SAVED_KEY),
          AsyncStorage.getItem(REVIEWS_KEY),
        ]);
        const parsed: Listing[] = storedListings ? JSON.parse(storedListings) : [];
        // Merge user listings with samples, replace sample_mine_* with user's actual name
        const storedName_ = storedName || "Korisnik";
        const mergedSamples = SAMPLE_LISTINGS.map((s) =>
          s.isMine ? { ...s, userName: storedName_ } : s
        );
        setListings([...parsed, ...mergedSamples]);
        if (storedName) setMyNameState(storedName);
        if (storedSaved) setSavedListingIds(JSON.parse(storedSaved));
        if (storedReviews) setReviews(JSON.parse(storedReviews));
      } catch {
        setListings(SAMPLE_LISTINGS);
      } finally {
        setIsLoaded(true);
      }
    }
    load();
  }, []);

  const saveUserListings = useCallback(async (userListings: Listing[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(userListings));
    } catch {}
  }, []);

  const setMyName = useCallback(async (name: string) => {
    setMyNameState(name);
    // Also update isMine listings with new name
    setListings((prev) =>
      prev.map((l) => (l.isMine ? { ...l, userName: name } : l))
    );
    try {
      await AsyncStorage.setItem(NAME_KEY, name);
    } catch {}
  }, []);

  const addListing = useCallback(
    (data: Omit<Listing, "id" | "createdAt" | "status" | "isMine" | "userName">) => {
      const newListing: Listing = {
        ...data,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        userName: myName,
        createdAt: Date.now(),
        status: "active",
        isMine: true,
      };
      setListings((prev) => {
        const updated = [newListing, ...prev];
        const userListings = updated.filter((l) => l.isMine && !l.id.startsWith("sample_"));
        saveUserListings(userListings);
        return updated;
      });
    },
    [myName, saveUserListings]
  );

  const markAsTraded = useCallback(
    (id: string) => {
      setListings((prev) => {
        const updated = prev.map((l) => (l.id === id ? { ...l, status: "traded" as const } : l));
        const userListings = updated.filter((l) => l.isMine && !l.id.startsWith("sample_"));
        saveUserListings(userListings);
        return updated;
      });
    },
    [saveUserListings]
  );

  const updateListing = useCallback(
    (id: string, updates: Partial<Pick<Listing, "title" | "description" | "wantedFor" | "price" | "category" | "location">>) => {
      setListings((prev) => {
        const updated = prev.map((l) => (l.id === id ? { ...l, ...updates } : l));
        const userListings = updated.filter((l) => l.isMine && !l.id.startsWith("sample_"));
        saveUserListings(userListings);
        return updated;
      });
    },
    [saveUserListings]
  );

  const markAsActive = useCallback(
    (id: string) => {
      setListings((prev) => {
        const updated = prev.map((l) => (l.id === id ? { ...l, status: "active" as const } : l));
        const userListings = updated.filter((l) => l.isMine && !l.id.startsWith("sample_"));
        saveUserListings(userListings);
        return updated;
      });
    },
    [saveUserListings]
  );

  const deleteListing = useCallback(
    (id: string) => {
      setListings((prev) => {
        const updated = prev.filter((l) => l.id !== id);
        const userListings = updated.filter((l) => l.isMine && !l.id.startsWith("sample_"));
        saveUserListings(userListings);
        return updated;
      });
    },
    [saveUserListings]
  );

  const saveListing = useCallback((id: string) => {
    setSavedListingIds((prev) => {
      if (prev.includes(id)) return prev;
      const updated = [...prev, id];
      AsyncStorage.setItem(SAVED_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const unsaveListing = useCallback((id: string) => {
    setSavedListingIds((prev) => {
      const updated = prev.filter((s) => s !== id);
      AsyncStorage.setItem(SAVED_KEY, JSON.stringify(updated)).catch(() => {});
      return updated;
    });
  }, []);

  const addReview = useCallback(
    (targetUserName: string, stars: number, comment: string) => {
      const review: Review = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 6),
        targetUserName,
        authorName: myName,
        stars,
        comment: comment.trim(),
        createdAt: Date.now(),
      };
      setReviews((prev) => {
        const updated = [review, ...prev];
        AsyncStorage.setItem(REVIEWS_KEY, JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    },
    [myName]
  );

  const deleteAllData = useCallback(async () => {
    await AsyncStorage.multiRemove([
      STORAGE_KEY,
      NAME_KEY,
      SAVED_KEY,
      REVIEWS_KEY,
      "@trampaj_onboarded_v1",
      "@trampaj_chat_v1",
    ]);
    setListings(SAMPLE_LISTINGS.filter((s) => !s.isMine));
    setMyNameState("Korisnik");
    setSavedListingIds([]);
    setReviews([]);
  }, []);

  return (
    <ListingsContext.Provider
      value={{
        listings,
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
