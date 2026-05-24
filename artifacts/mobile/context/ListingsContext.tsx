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

export interface Listing {
  id: string;
  title: string;
  description: string;
  category: string;
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

interface ListingsContextType {
  listings: Listing[];
  myName: string;
  setMyName: (name: string) => void;
  addListing: (listing: Omit<Listing, "id" | "createdAt" | "status" | "isMine" | "userName">) => void;
  updateListing: (id: string, updates: Partial<Pick<Listing, "title" | "description" | "wantedFor" | "price" | "category" | "location">>) => void;
  markAsTraded: (id: string) => void;
  markAsActive: (id: string) => void;
  deleteListing: (id: string) => void;
  isLoaded: boolean;
}

const ListingsContext = createContext<ListingsContextType | null>(null);

const STORAGE_KEY = "@trampaj_listings_v2";
const NAME_KEY = "@trampaj_name";

const SAMPLE_LISTINGS: Listing[] = [
  {
    id: "sample_1",
    title: "Sony slušalice WH-1000XM4",
    description: "Odlične slušalice s redukcijom buke, malo korištene. U originalnoj kutiji, sve ispravno radi.",
    category: "Elektronika",
    wantedFor: "Bežična tipkovnica ili miš visokog kvaliteta",
    price: 180,
    imageUri: null,
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
    wantedFor: "Ljetna jakna ili sportska oprema",
    price: null,
    imageUri: null,
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
    wantedFor: "Sci-fi knjige ili stripovi",
    price: 60,
    imageUri: null,
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
    wantedFor: "Roleri ili električni romobil",
    price: 350,
    imageUri: null,
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
    wantedFor: "Polica za knjige ili mali stol",
    price: null,
    imageUri: null,
    phone: null,
    userName: "Tomislav R.",
    location: "Zagreb",
    createdAt: Date.now() - 86400000 * 7,
    status: "active",
    isMine: false,
  },
];

export function ListingsProvider({ children }: { children: React.ReactNode }) {
  const [listings, setListings] = useState<Listing[]>([]);
  const [myName, setMyNameState] = useState<string>("Korisnik");
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [storedListings, storedName] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(NAME_KEY),
        ]);
        const parsed: Listing[] = storedListings ? JSON.parse(storedListings) : [];
        setListings([...parsed, ...SAMPLE_LISTINGS]);
        if (storedName) setMyNameState(storedName);
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
        const userListings = updated.filter((l) => l.isMine);
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
        const userListings = updated.filter((l) => l.isMine);
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
        const userListings = updated.filter((l) => l.isMine);
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
        const userListings = updated.filter((l) => l.isMine);
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
        const userListings = updated.filter((l) => l.isMine);
        saveUserListings(userListings);
        return updated;
      });
    },
    [saveUserListings]
  );

  return (
    <ListingsContext.Provider
      value={{ listings, myName, setMyName, addListing, updateListing, markAsTraded, markAsActive, deleteListing, isLoaded }}
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
