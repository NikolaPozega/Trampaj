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
  blockedUserNames: string[];
  blockUser: (userName: string) => void;
  unblockUser: (userName: string) => void;
  refreshListings: () => Promise<void>;
  refreshMyListings: () => Promise<void>;
}

const ListingsContext = createContext<ListingsContextType | null>(null);

const API_BASE = process.env["EXPO_PUBLIC_DOMAIN"]
  ? `https://${process.env["EXPO_PUBLIC_DOMAIN"]}/api`
  : "/api";

// ─── Sample listings (shown when not connected / API empty) ──────────────────
const SAMPLE_LISTINGS: Listing[] = [
  { id: "sample_1", title: "Sony slušalice WH-1000XM4", description: "Odlične slušalice s redukcijom buke, malo korištene. U originalnoj kutiji, sve ispravno radi.", category: "Elektronika", condition: "Jako dobro", wantedFor: "Bežična tipkovnica ili miš visokog kvaliteta", price: 180, imageUris: ["https://picsum.photos/seed/headphones1/400/300"], phone: "091 123 4567", userName: "Marko K.", location: "Zagreb", createdAt: Date.now() - 86400000 * 2, status: "active", isMine: false, packageSize: "small", packageBoxSize: "M" },
  { id: "sample_2", title: "Zimska jakna XL, North Face", description: "Topla zimska jakna, nosio je jednu sezonu. Boja tamno plava, odlično stanje.", category: "Odjeća", condition: "Jako dobro", wantedFor: "Ljetna jakna ili sportska oprema", price: null, imageUris: ["https://picsum.photos/seed/jacket2/400/300"], phone: null, userName: "Ana P.", location: "Split", createdAt: Date.now() - 86400000 * 5, status: "active", isMine: false, packageSize: "small", packageBoxSize: "M" },
  { id: "sample_3", title: "Skup knjiga - fantazija (10 knjiga)", description: "Komplet knjiga Patricka Rothfussa i Brandona Sandersona. Sve u odličnom stanju.", category: "Knjige", condition: "Kao novo", wantedFor: "Sci-fi knjige ili stripovi", price: 60, imageUris: ["https://picsum.photos/seed/books3/400/300"], phone: "095 765 4321", userName: "Luka B.", location: "Rijeka", createdAt: Date.now() - 86400000 * 1, status: "active", isMine: false, packageSize: "medium", packageWeight: 4 },
  { id: "sample_4", title: "Bicikl - gradski, 26\"", description: "Gradski bicikl, servisiran prošle godine. Nova guma naprijed. Boja srebrna.", category: "Sport", condition: "Dobro", wantedFor: "Roleri ili električni romobil", price: 350, imageUris: ["https://picsum.photos/seed/bicycle4/400/300"], phone: "098 111 2233", userName: "Petra M.", location: "Osijek", createdAt: Date.now() - 86400000 * 3, status: "active", isMine: false, packageSize: "large" },
  { id: "sample_5", title: "Stolna lampa - industrijski stil", description: "Metalna lampa, crna boja, LED žarulja uključena. Idealna za radni stol.", category: "Namještaj", condition: "Dobro", wantedFor: "Polica za knjige ili mali stol", price: null, imageUris: ["https://picsum.photos/seed/lamp5/400/300"], phone: null, userName: "Tomislav R.", location: "Zagreb", createdAt: Date.now() - 86400000 * 7, status: "active", isMine: false, packageSize: "medium", packageWeight: 3 },
  { id: "sample_6", title: "Roleri Rollerblade, vel. 42", description: "Inline roleri u odličnom stanju, korišteni svega par puta. Kaciga uključena.", category: "Sport", condition: "Kao novo", wantedFor: "Bicikl gradski ili električni romobil", price: 120, imageUris: ["https://picsum.photos/seed/skates6/400/300"], phone: "091 555 7788", userName: "Ivan S.", location: "Zagreb", createdAt: Date.now() - 86400000 * 2, status: "active", isMine: false, packageSize: "small", packageBoxSize: "L" },
  { id: "sample_7", title: "Bežični miš Logitech MX Master 3", description: "Premium miš, ergonomski, savršen za dugotrajni rad. Baterija traje 70 dana.", category: "Elektronika", condition: "Jako dobro", wantedFor: "Mehanička tipkovnica ili slušalice", price: 90, imageUris: ["https://picsum.photos/seed/mouse7/400/300"], phone: null, userName: "Viktor N.", location: "Zagreb", createdAt: Date.now() - 86400000 * 1, status: "active", isMine: false, packageSize: "small", packageBoxSize: "S" },
  { id: "sample_8", title: "iPad 9. generacija, 64GB", description: "iPad u odličnom stanju, s torbom i punjačem. Bez ogrebotina na ekranu.", category: "Elektronika", condition: "Jako dobro", wantedFor: "Laptop ili MacBook bilo koje generacije", price: 300, imageUris: ["https://picsum.photos/seed/ipad9/400/300"], phone: "098 444 5566", userName: "Filip H.", location: "Zagreb", createdAt: Date.now() - 86400000 * 3, status: "active", isMine: false, packageSize: "small", packageBoxSize: "S" },
  { id: "sample_9", title: "Električna gitara + pojačalo", description: "Squier Stratocaster u crnoj boji + Fender pojačalo 15W. Savršeno za početnike.", category: "Glazba", condition: "Dobro", wantedFor: "Akustična gitara ili ukulele", price: 250, imageUris: ["https://picsum.photos/seed/guitar9/400/300"], phone: "091 222 3344", userName: "Dario V.", location: "Zagreb", createdAt: Date.now() - 86400000 * 4, status: "active", isMine: false, packageSize: "large" },
  { id: "sample_10", title: "Dječja kolica Bugaboo", description: "Kolica u odličnom stanju, lako sklopiva. Sva dodatna oprema uključena.", category: "Djeca", condition: "Jako dobro", wantedFor: "Dječje autosjedalište ili hodalica", price: null, imageUris: ["https://picsum.photos/seed/pram10/400/300"], phone: "095 333 4455", userName: "Maja Š.", location: "Zadar", createdAt: Date.now() - 86400000 * 6, status: "active", isMine: false, packageSize: "large" },
  { id: "sample_11", title: "Samsung Galaxy Watch 5", description: "Pametni sat, 44mm, crni. Baterija drži 40h, GPS, NFC. Sve ispravno.", category: "Elektronika", condition: "Kao novo", wantedFor: "Apple Watch ili Garmin", price: 150, imageUris: ["https://picsum.photos/seed/watch11/400/300"], phone: null, userName: "Leon P.", location: "Split", createdAt: Date.now() - 86400000 * 1, status: "active", isMine: false, packageSize: "small", packageBoxSize: "S" },
  { id: "sample_12", title: "Teniski reket Wilson + torba", description: "Wilson Clash 100 reket + teniška torba. Žice nove, reket malo korišten.", category: "Sport", condition: "Jako dobro", wantedFor: "Badminton oprema ili squash reket", price: 120, imageUris: ["https://picsum.photos/seed/tennis12/400/300"], phone: "091 777 8899", userName: "Karla M.", location: "Zagreb", createdAt: Date.now() - 86400000 * 2, status: "active", isMine: false, packageSize: "medium", packageWeight: 2 },
  { id: "sample_13", title: "Kuhinjski robot Kenwood Chef", description: "Moćan kuhinjski robot 1500W s priključcima za gnječenje, miješanje, ribanje. U kutiji.", category: "Kućanstvo", condition: "Jako dobro", wantedFor: "Aparat za kavu ili blender", price: 200, imageUris: ["https://picsum.photos/seed/robot13/400/300"], phone: "092 555 6677", userName: "Sunčica B.", location: "Varaždin", createdAt: Date.now() - 86400000 * 8, status: "active", isMine: false, packageSize: "medium", packageWeight: 5 },
  { id: "sample_14", title: "Vintage Levi's 501 traperice, vel. 32", description: "Originalne vintage 501-ice, wash iz 90-ih. Odlično stanje, malo nošene.", category: "Odjeća", condition: "Jako dobro", wantedFor: "Vintage majice ili denim jakna", price: 45, imageUris: ["https://picsum.photos/seed/levis14/400/300"], phone: null, userName: "Nina R.", location: "Zagreb", createdAt: Date.now() - 86400000 * 3, status: "active", isMine: false, packageSize: "small", packageBoxSize: "M" },
  { id: "sample_15", title: "DJI Mavic Mini 2 dron", description: "Dron u kutiji sa svim opremama. 3 baterije, punjač, torba. Letio par puta.", category: "Elektronika", condition: "Kao novo", wantedFor: "Akcijska kamera ili gimbal", price: 380, imageUris: ["https://picsum.photos/seed/drone15/400/300"], phone: "098 999 0011", userName: "Bruno K.", location: "Dubrovnik", createdAt: Date.now() - 86400000 * 2, status: "active", isMine: false, packageSize: "small", packageBoxSize: "L" },
  { id: "sample_16", title: "Bonsai drvo - ficus, 15 godina star", description: "Odrasli ficus bonsai u keramičkoj posudi. Visina 35cm. Lako ga je održavati.", category: "Vrt", condition: "Dobro", wantedFor: "Sukulenti ili kaktuski kolekcija", price: null, imageUris: ["https://picsum.photos/seed/bonsai16/400/300"], phone: "091 100 2200", userName: "Zlata F.", location: "Karlovac", createdAt: Date.now() - 86400000 * 10, status: "active", isMine: false, packageSize: "medium", packageWeight: 3 },
  { id: "sample_17", title: "PlayStation 5 kontroler DualSense", description: "Sony PS5 kontroler, bijeli. Haptic feedback, adaptivni okidači, punjač u kutiji.", category: "Elektronika", condition: "Jako dobro", wantedFor: "Xbox kontroler ili Nintendo Switch Joy-Con", price: 70, imageUris: ["https://picsum.photos/seed/ps5ctrl17/400/300"], phone: null, userName: "Ante J.", location: "Split", createdAt: Date.now() - 86400000 * 1, status: "active", isMine: false, packageSize: "small", packageBoxSize: "M" },
  { id: "sample_18", title: "Kožna sofá - trosjed, smeđa", description: "Kvalitetna kožna sofa, malo izlizano sjedalo ali strukturno savršeno. Dostava moguća.", category: "Namještaj", condition: "Dobro", wantedFor: "Blagovaonski stol ili stolice", price: 500, imageUris: ["https://picsum.photos/seed/sofa18/400/300"], phone: "091 400 5500", userName: "Branko T.", location: "Zagreb", createdAt: Date.now() - 86400000 * 12, status: "active", isMine: false, packageSize: "large" },
  { id: "sample_19", title: "Canon EOS 250D + objektiv 18-55mm", description: "DSLR fotoaparat za početnike, 24MP. Samo 3000 okidanja. Torba i 2 baterije.", category: "Elektronika", condition: "Kao novo", wantedFor: "Mirrorless fotoaparat ili objektiv 50mm", price: 450, imageUris: ["https://picsum.photos/seed/canon19/400/300"], phone: "092 600 7700", userName: "Lena D.", location: "Rijeka", createdAt: Date.now() - 86400000 * 4, status: "active", isMine: false, packageSize: "small", packageBoxSize: "L" },
  { id: "sample_20", title: "Planinska šuma - snowboard komplet", description: "Snowboard 155cm + vezovi + cipele vel. 43. Korišten 2 sezone.", category: "Sport", condition: "Dobro", wantedFor: "Skije s vezovima ili splitboard", price: 280, imageUris: ["https://picsum.photos/seed/snowboard20/400/300"], phone: "098 800 9900", userName: "Goran L.", location: "Zagreb", createdAt: Date.now() - 86400000 * 15, status: "active", isMine: false, packageSize: "large" },
  { id: "sample_21", title: "Saksofon alto - Yamaha YAS-280", description: "Alto saksofon za početnike i amatere. Dolazi s futrolom i notama.", category: "Glazba", condition: "Jako dobro", wantedFor: "Klavijatura ili truba", price: 350, imageUris: ["https://picsum.photos/seed/sax21/400/300"], phone: null, userName: "Ivana G.", location: "Osijek", createdAt: Date.now() - 86400000 * 5, status: "active", isMine: false, packageSize: "medium", packageWeight: 4 },
  { id: "sample_22", title: "Planinska šupa - survival oprema komplet", description: "Set za preživljavanje: šator 2 mjesta, vreća za spavanje -10°C, headlamp, nož.", category: "Sport", condition: "Jako dobro", wantedFor: "Kajakaška oprema ili penjačka", price: 150, imageUris: ["https://picsum.photos/seed/survival22/400/300"], phone: "091 250 3350", userName: "Hrvoje P.", location: "Karlovac", createdAt: Date.now() - 86400000 * 7, status: "active", isMine: false, packageSize: "medium", packageWeight: 6 },
  { id: "sample_23", title: "Espresso aparat De'Longhi Dedica", description: "Slim dizajn, 15 bar pritisak. Savršeno kafe svaki put. U odličnom stanju.", category: "Kućanstvo", condition: "Jako dobro", wantedFor: "French press komplet ili Moka lonac set", price: 100, imageUris: ["https://picsum.photos/seed/espresso23/400/300"], phone: null, userName: "Maja B.", location: "Zagreb", createdAt: Date.now() - 86400000 * 2, status: "active", isMine: false, packageSize: "small", packageBoxSize: "L" },
  { id: "sample_24", title: "Yoga oprema komplet - prostirka + blokovi", description: "Manduka PRO prostirka + 2 pluta bloka + remen. Sve kao novo.", category: "Sport", condition: "Kao novo", wantedFor: "Pilates oprema ili fitnes gume", price: null, imageUris: ["https://picsum.photos/seed/yoga24/400/300"], phone: "091 350 4450", userName: "Sara K.", location: "Zagreb", createdAt: Date.now() - 86400000 * 3, status: "active", isMine: false, packageSize: "medium", packageWeight: 3 },
  { id: "sample_25", title: "Scooter električni - Xiaomi Pro 2", description: "E-romobil domet 45km, max 25km/h. Malo korišten, punjač u kutiji.", category: "Prijevoz", condition: "Jako dobro", wantedFor: "Električni bicikl ili skateboard", price: 350, imageUris: ["https://picsum.photos/seed/scooter25/400/300"], phone: "092 450 5550", userName: "Tin M.", location: "Split", createdAt: Date.now() - 86400000 * 6, status: "active", isMine: false, packageSize: "large" },
  { id: "sample_26", title: "Uljana slika - apstraktan motiv 80x60cm", description: "Ručno rađena uljana slika na platnu. Savršeno za dnevni boravak.", category: "Umjetnost", condition: "Kao novo", wantedFor: "Skulptura ili fotografska grafika", price: 80, imageUris: ["https://picsum.photos/seed/painting26/400/300"], phone: null, userName: "Marta V.", location: "Zagreb", createdAt: Date.now() - 86400000 * 9, status: "active", isMine: false, packageSize: "medium", packageWeight: 2 },
  { id: "sample_27", title: "3D printer - Prusa Mini+", description: "Prusa Mini+ build volume 18x18x18cm. Malo korišten, kalibriran. Filament uključen.", category: "Elektronika", condition: "Jako dobro", wantedFor: "CNC glodalica ili laser gravira", price: 400, imageUris: ["https://picsum.photos/seed/printer27/400/300"], phone: "091 550 6650", userName: "Dino H.", location: "Zagreb", createdAt: Date.now() - 86400000 * 5, status: "active", isMine: false, packageSize: "medium", packageWeight: 4 },
  { id: "sample_28", title: "Kolekcija LEGO Star Wars - 5 setova", description: "5 složenih LEGO setova SW, sve figure, uputstva, originalne kutije. Bez nedostajućih dijelova.", category: "Igračke", condition: "Jako dobro", wantedFor: "LEGO Technic ili kolekcija Funko Pop", price: 220, imageUris: ["https://picsum.photos/seed/lego28/400/300"], phone: null, userName: "Kristian N.", location: "Varaždin", createdAt: Date.now() - 86400000 * 4, status: "active", isMine: false, packageSize: "medium", packageWeight: 5 },
];

// ─── Provider ────────────────────────────────────────────────────────────────
export function ListingsProvider({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  const [listings, setListings] = useState<Listing[]>([]);
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [savedListingIds, setSavedListingIds] = useState<string[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [blockedUserNames, setBlockedUserNames] = useState<string[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
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
        const data = await res.json() as { listings: Listing[] };
        setMyListings(data.listings.map((l) => ({
          ...l,
          isMine: true,
          imageUris: Array.isArray(l.imageUris) ? l.imageUris : [],
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
        const data = await res.json() as { listings: Listing[] };
        if (data.listings.length > 0) {
          setListings(data.listings.map((l) => ({
            ...l,
            imageUris: Array.isArray(l.imageUris) ? l.imageUris : [],
            nudimTags: Array.isArray(l.nudimTags) ? l.nudimTags : [],
            trazimTags: Array.isArray(l.trazimTags) ? l.trazimTags : [],
          })));
          return;
        }
      }
    } catch { /* offline or timeout */ }
    // Fallback to sample listings when DB is empty or offline
    setListings(SAMPLE_LISTINGS);
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
    (data: Omit<Listing, "id" | "createdAt" | "status" | "isMine" | "userName">) => {
      if (!tokenRef.current) return;
      fetch(`${API_BASE}/listings`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(data),
      })
        .then((r) => r.ok ? Promise.all([refreshListings(), refreshMyListings()]) : null)
        .catch(() => {});
    },
    [authHeaders, refreshListings, refreshMyListings]
  );

  const updateListing = useCallback(
    (id: string, updates: Partial<Pick<Listing, "title" | "description" | "wantedFor" | "price" | "category" | "location" | "condition">>) => {
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
    setListings(SAMPLE_LISTINGS);
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
