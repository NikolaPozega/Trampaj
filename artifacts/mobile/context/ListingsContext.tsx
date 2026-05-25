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

export type Topup = "primam" | "dajem" | "oboje" | "ne";
export type Flexibility = "tocno" | "otvoren";
export type Deadline = "hitno" | "ovaj-mjesec" | "bez-roka";

export interface Listing {
  id: string;
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
  isMine: boolean;
  topup?: Topup | null;
  flexibility?: Flexibility | null;
  cashFallback?: boolean | null;
  deadline?: Deadline | null;
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
    imageUris: ["https://picsum.photos/seed/headphones1/400/300"],
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
    imageUris: ["https://picsum.photos/seed/jacket2/400/300"],
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
    imageUris: ["https://picsum.photos/seed/books3/400/300"],
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
    imageUris: ["https://picsum.photos/seed/bicycle4/400/300"],
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
    imageUris: ["https://picsum.photos/seed/lamp5/400/300"],
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
    imageUris: ["https://picsum.photos/seed/skates6/400/300"],
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
    imageUris: ["https://picsum.photos/seed/mouse7/400/300"],
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
    imageUris: ["https://picsum.photos/seed/jacket8/400/300"],
    phone: "092 333 1122",
    userName: "Maja L.",
    location: "Split",
    createdAt: Date.now() - 86400000 * 4,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_9",
    title: "PS5 kontroler DualSense",
    description: "Originalni PlayStation 5 kontroler, crna boja. Baterija drži odlično, nema ogrebotina.",
    category: "Elektronika",
    condition: "Jako dobro",
    wantedFor: "Xbox kontroler ili gaming slušalice",
    price: 70,
    imageUris: ["https://picsum.photos/seed/ps5ctrl/400/300"],
    phone: null,
    userName: "Bruno T.",
    location: "Zagreb",
    createdAt: Date.now() - 86400000 * 1,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_10",
    title: "Tenisice Nike Air Max 90, vel. 43",
    description: "Klasične Nike patike, nošene desetak puta. Bez oštećenja, original kutija.",
    category: "Odjeća",
    condition: "Jako dobro",
    wantedFor: "Adidas ili New Balance iste veličine",
    price: 80,
    imageUris: ["https://picsum.photos/seed/nike43/400/300"],
    phone: "091 222 3344",
    userName: "Klara M.",
    location: "Rijeka",
    createdAt: Date.now() - 86400000 * 2,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_11",
    title: "iPad 9. generacija, 64GB",
    description: "iPad u odličnom stanju, s torbom i punjačem. Bez ogrebotina na ekranu.",
    category: "Elektronika",
    condition: "Jako dobro",
    wantedFor: "Laptop ili MacBook bilo koje generacije",
    price: 300,
    imageUris: ["https://picsum.photos/seed/ipad9/400/300"],
    phone: "098 444 5566",
    userName: "Filip H.",
    location: "Zagreb",
    createdAt: Date.now() - 86400000 * 3,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_12",
    title: "Ruksak Osprey Farpoint 40L",
    description: "Putni ruksak, korišten na 3 putovanja. Bez oštećenja, svi džepovi funkcionalni.",
    category: "Sport",
    condition: "Dobro",
    wantedFor: "Manji ruksak do 20L ili torba",
    price: 110,
    imageUris: ["https://picsum.photos/seed/osprey40/400/300"],
    phone: null,
    userName: "Sara K.",
    location: "Split",
    createdAt: Date.now() - 86400000 * 4,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_13",
    title: "Električni skuter Xiaomi Mi 3",
    description: "Električni romobil, domet 30km. Baterija odlična, bez vidljivih oštećenja.",
    category: "Sport",
    condition: "Jako dobro",
    wantedFor: "Bicikl gradski ili BMX",
    price: 400,
    imageUris: ["https://picsum.photos/seed/scooter3/400/300"],
    phone: "092 888 9900",
    userName: "Nikolina B.",
    location: "Zagreb",
    createdAt: Date.now() - 86400000 * 5,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_14",
    title: "Kuhinjski robot Kenwood kMix",
    description: "Kuhinjski robot s više nastavaka za tijesto, mješanje i tucanje. Rijetko korišten.",
    category: "Namještaj",
    condition: "Kao novo",
    wantedFor: "Blender ili sokovnik",
    price: 200,
    imageUris: ["https://picsum.photos/seed/kenwood/400/300"],
    phone: null,
    userName: "Vesna P.",
    location: "Osijek",
    createdAt: Date.now() - 86400000 * 6,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_15",
    title: "Gitara akustična Yamaha F310",
    description: "Početna akustična gitara u dobrom stanju. Nova žica postavljena prošli tjedan.",
    category: "Ostalo",
    condition: "Dobro",
    wantedFor: "Električna gitara ili klavijature",
    price: 100,
    imageUris: ["https://picsum.photos/seed/yamahaf310/400/300"],
    phone: "091 777 8899",
    userName: "Matej D.",
    location: "Zagreb",
    createdAt: Date.now() - 86400000 * 2,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_16",
    title: "Sat Casio G-Shock GA-2100",
    description: "Robusni sat, nošen godinu dana. Bez ogrebotina na staklu, baterija nova.",
    category: "Nakit",
    condition: "Jako dobro",
    wantedFor: "Sportski sat ili pametni sat",
    price: 90,
    imageUris: ["https://picsum.photos/seed/gshock/400/300"],
    phone: null,
    userName: "Ante V.",
    location: "Split",
    createdAt: Date.now() - 86400000 * 3,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_17",
    title: "Monitor LG 27\" IPS 4K",
    description: "Monitor s USB-C i HDMI ulazima, idealan za rad i gaming. Bez dead pixela.",
    category: "Elektronika",
    condition: "Kao novo",
    wantedFor: "Laptop prijenosnik ili tablet",
    price: 350,
    imageUris: ["https://picsum.photos/seed/lgmonitor/400/300"],
    phone: "098 333 2211",
    userName: "Renata K.",
    location: "Zagreb",
    createdAt: Date.now() - 86400000 * 1,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_18",
    title: "Snowboard komplet, vel. 155",
    description: "Snowboard s vezovima i čizmama. Korišten dvije sezone, sve u odličnom stanju.",
    category: "Sport",
    condition: "Dobro",
    wantedFor: "Skije komplet ili wakeboard",
    price: 250,
    imageUris: ["https://picsum.photos/seed/snowboard/400/300"],
    phone: null,
    userName: "Josip R.",
    location: "Zagreb",
    createdAt: Date.now() - 86400000 * 10,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_19",
    title: "Vintage naočale Ray-Ban Wayfarer",
    description: "Originalne Ray-Ban Wayfarer, crni okvir, UV400 zaštita. Kutija i krpica uključene.",
    category: "Nakit",
    condition: "Jako dobro",
    wantedFor: "Sat ili narukvica",
    price: 60,
    imageUris: ["https://picsum.photos/seed/rayban/400/300"],
    phone: "095 111 9988",
    userName: "Lucija M.",
    location: "Rijeka",
    createdAt: Date.now() - 86400000 * 4,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_20",
    title: "Lego Technic 42128, kamion",
    description: "Lego Technic teški kamion, kompletan set s uputama. Sastavljen jednom i rasklopljen.",
    category: "Igračke",
    condition: "Kao novo",
    wantedFor: "Lego City ili Lego Technic auto",
    price: 120,
    imageUris: ["https://picsum.photos/seed/legotruck/400/300"],
    phone: null,
    userName: "Damir L.",
    location: "Zagreb",
    createdAt: Date.now() - 86400000 * 5,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_21",
    title: "Termomix TM5 kuhinjski robot",
    description: "Malo korišten kuhinjski robot s receptima. Sve funkcionira besprijekorno.",
    category: "Namještaj",
    condition: "Jako dobro",
    wantedFor: "AirFryer ili aparat za kavu",
    price: 600,
    imageUris: ["https://picsum.photos/seed/thermomix/400/300"],
    phone: "091 444 5500",
    userName: "Gordana T.",
    location: "Osijek",
    createdAt: Date.now() - 86400000 * 7,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_22",
    title: "Električna romobil Ninebot E25E",
    description: "Segway-Ninebot romobil s LED svjetlima i APP kontrolom. Domet 25km.",
    category: "Sport",
    condition: "Prihvatljivo",
    wantedFor: "Bicikl gradski ili električni bicikl",
    price: 280,
    imageUris: ["https://picsum.photos/seed/ninebot/400/300"],
    phone: null,
    userName: "Zoran B.",
    location: "Zagreb",
    createdAt: Date.now() - 86400000 * 8,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_23",
    title: "Knjige o programiranju (8 kom)",
    description: "Clean Code, Design Patterns, JavaScript: Good Parts i ostale. Sve u odličnom stanju.",
    category: "Knjige",
    condition: "Dobro",
    wantedFor: "Knjige o poslovanju ili filozofiji",
    price: 80,
    imageUris: ["https://picsum.photos/seed/devbooks/400/300"],
    phone: "098 222 3344",
    userName: "Kristian M.",
    location: "Zagreb",
    createdAt: Date.now() - 86400000 * 2,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_24",
    title: "Kamera Sony Alpha a6000",
    description: "Mirrorless kamera s 16-50mm objektivom. Izvrsna za fotografiju i video. Malo korištena.",
    category: "Elektronika",
    condition: "Jako dobro",
    wantedFor: "Canon ili Fujifilm mirrorless",
    price: 450,
    imageUris: ["https://picsum.photos/seed/sonya6000/400/300"],
    phone: null,
    userName: "Nela S.",
    location: "Split",
    createdAt: Date.now() - 86400000 * 3,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_25",
    title: "Stolni tenis, Butterfly komplet",
    description: "Dva Butterfly reketa s torbom i lopticama. Odlično za rekreativce.",
    category: "Sport",
    condition: "Dobro",
    wantedFor: "Badminton ili teniski reketi",
    price: 45,
    imageUris: ["https://picsum.photos/seed/pingpong/400/300"],
    phone: "092 666 7788",
    userName: "Tomislav K.",
    location: "Osijek",
    createdAt: Date.now() - 86400000 * 6,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_26",
    title: "Narukvica Pandora, srebro",
    description: "Originalna Pandora narukvica s tri charmsa. S kutijom i certifikatom.",
    category: "Nakit",
    condition: "Kao novo",
    wantedFor: "Naušnice ili ogrlica srebro",
    price: 100,
    imageUris: ["https://picsum.photos/seed/pandora/400/300"],
    phone: null,
    userName: "Ines F.",
    location: "Zagreb",
    createdAt: Date.now() - 86400000 * 1,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_27",
    title: "Dječji romobil Micro Maxi",
    description: "Romobil za djecu 5-12 godina, malo korišten. Sve funkcionira, bez ogrebotina.",
    category: "Igračke",
    condition: "Jako dobro",
    wantedFor: "Bicikl za djecu ili skuter",
    price: 55,
    imageUris: ["https://picsum.photos/seed/kidsscooter/400/300"],
    phone: "091 888 4455",
    userName: "Jasna B.",
    location: "Rijeka",
    createdAt: Date.now() - 86400000 * 9,
    status: "active",
    isMine: false,
  },
  {
    id: "sample_28",
    title: "MacBook Air M1, 8GB/256GB",
    description: "Laptop u odličnom stanju, baterija 89% zdravlja. Bez ogrebotina, original kutija.",
    category: "Elektronika",
    condition: "Jako dobro",
    wantedFor: "iPad Pro ili monitor 27\"",
    price: 800,
    imageUris: ["https://picsum.photos/seed/macbookm1/400/300"],
    phone: null,
    userName: "Igor P.",
    location: "Zagreb",
    createdAt: Date.now() - 86400000 * 2,
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
    imageUris: ["https://picsum.photos/seed/keyboard9/400/300"],
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
    imageUris: ["https://picsum.photos/seed/mtb10/400/300"],
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
    imageUris: ["https://picsum.photos/seed/scifi11/400/300"],
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
        const rawParsed: Array<Listing & { imageUri?: string | null }> = storedListings ? JSON.parse(storedListings) : [];
        const parsed: Listing[] = rawParsed.map((l) =>
          Array.isArray(l.imageUris) ? l : { ...l, imageUris: l.imageUri ? [l.imageUri] : [] }
        );
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
