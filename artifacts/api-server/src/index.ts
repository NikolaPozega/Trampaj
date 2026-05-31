import app from "./app";
import { logger } from "./lib/logger";
import { db, listingsTable, usersTable } from "@workspace/db";
import { count, eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function initStripe() {
  try {
    const { runMigrations } = await import("stripe-replit-sync");
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error("DATABASE_URL required");

    await runMigrations({ databaseUrl });

    const { getStripeSync } = await import("./stripeClient");
    const stripeSync = await getStripeSync();

    const domains = process.env.REPLIT_DOMAINS?.split(",");
    const webhookBaseUrl = domains?.[0]
      ? `https://${domains[0]}`
      : `http://localhost:${port}`;

    await stripeSync.findOrCreateManagedWebhook(
      `${webhookBaseUrl}/api/stripe/webhook`
    );

    await stripeSync.syncBackfill();
    logger.info("Stripe initialized successfully");
  } catch (err) {
    logger.warn({ err }, "Stripe initialization skipped (not connected or error)");
  }
}

async function seedIfEmpty() {
  try {
    const [row] = await db.select({ c: count() }).from(listingsTable);
    if ((row?.c ?? 0) >= 20) return; // already seeded enough

    const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
    const existingUser = await db.select({ id: usersTable.id })
      .from(usersTable).where(eq(usersTable.id, DEMO_USER_ID)).limit(1);

    if (existingUser.length === 0) {
      const passwordHash = await bcrypt.hash("TrampaDemo2025!", 12);
      await db.insert(usersTable).values({
        id: DEMO_USER_ID,
        username: "TrampaDemo",
        email: "demo@trampaj.hr",
        passwordHash,
        isVerified: true,
      });
    }

    // Fetch existing titles to avoid duplicates when re-seeding a partially-filled DB
    const existingRows = await db.select({ title: listingsTable.title }).from(listingsTable);
    const existingTitles = new Set(existingRows.map((r) => r.title));

    const demoListings = [
      { title: "Sony slušalice WH-1000XM4", description: "Odlične slušalice s redukcijom buke, malo korištene. U originalnoj kutiji, sve ispravno radi.", category: "Elektronika", condition: "Jako dobro", wantedFor: "Bežična tipkovnica ili miš visokog kvaliteta", price: 180, imageUris: '["https://picsum.photos/seed/headphones1/400/300"]', phone: "091 123 4567", location: "Zagreb", packageSize: "small", packageBoxSize: "M", daysAgo: 2 },
      { title: "Zimska jakna XL, North Face", description: "Topla zimska jakna, nosio je jednu sezonu. Boja tamno plava, odlično stanje.", category: "Odjeća", condition: "Jako dobro", wantedFor: "Ljetna jakna ili sportska oprema", price: null, imageUris: '["https://picsum.photos/seed/jacket2/400/300"]', phone: null, location: "Split", packageSize: "small", packageBoxSize: "M", daysAgo: 5 },
      { title: "Skup knjiga - fantazija (10 knjiga)", description: "Komplet knjiga Patricka Rothfussa i Brandona Sandersona. Sve u odličnom stanju.", category: "Knjige", condition: "Kao novo", wantedFor: "Sci-fi knjige ili stripovi", price: 60, imageUris: '["https://picsum.photos/seed/books3/400/300"]', phone: "095 765 4321", location: "Rijeka", packageSize: "medium", packageBoxSize: null, daysAgo: 1 },
      { title: `Bicikl - gradski, 26"`, description: "Gradski bicikl, servisiran prošle godine. Nova guma naprijed. Boja srebrna.", category: "Sport", condition: "Dobro", wantedFor: "Roleri ili električni romobil", price: 350, imageUris: '["https://picsum.photos/seed/bicycle4/400/300"]', phone: "098 111 2233", location: "Osijek", packageSize: "large", packageBoxSize: null, daysAgo: 3 },
      { title: "Stolna lampa - industrijski stil", description: "Metalna lampa, crna boja, LED žarulja uključena. Idealna za radni stol.", category: "Namještaj", condition: "Dobro", wantedFor: "Polica za knjige ili mali stol", price: null, imageUris: '["https://picsum.photos/seed/lamp5/400/300"]', phone: null, location: "Zagreb", packageSize: "medium", packageBoxSize: null, daysAgo: 7 },
      { title: "Roleri Rollerblade, vel. 42", description: "Inline roleri u odličnom stanju, korišteni svega par puta. Kaciga uključena.", category: "Sport", condition: "Kao novo", wantedFor: "Bicikl gradski ili električni romobil", price: 120, imageUris: '["https://picsum.photos/seed/skates6/400/300"]', phone: "091 555 7788", location: "Zagreb", packageSize: "small", packageBoxSize: "L", daysAgo: 2 },
      { title: "Bežični miš Logitech MX Master 3", description: "Premium miš, ergonomski, savršen za dugotrajni rad. Baterija traje 70 dana.", category: "Elektronika", condition: "Jako dobro", wantedFor: "Mehanička tipkovnica ili slušalice", price: 90, imageUris: '["https://picsum.photos/seed/mouse7/400/300"]', phone: null, location: "Zagreb", packageSize: "small", packageBoxSize: "S", daysAgo: 1 },
      { title: "iPad 9. generacija, 64GB", description: "iPad u odličnom stanju, s torbom i punjačem. Bez ogrebotina na ekranu.", category: "Elektronika", condition: "Jako dobro", wantedFor: "Laptop ili MacBook bilo koje generacije", price: 300, imageUris: '["https://picsum.photos/seed/ipad9/400/300"]', phone: "098 444 5566", location: "Zagreb", packageSize: "small", packageBoxSize: "S", daysAgo: 3 },
      { title: "Električna gitara + pojačalo", description: "Squier Stratocaster u crnoj boji + Fender pojačalo 15W. Savršeno za početnike.", category: "Glazba", condition: "Dobro", wantedFor: "Akustična gitara ili ukulele", price: 250, imageUris: '["https://picsum.photos/seed/guitar9/400/300"]', phone: "091 222 3344", location: "Zagreb", packageSize: "large", packageBoxSize: null, daysAgo: 4 },
      { title: "Dječja kolica Bugaboo", description: "Kolica u odličnom stanju, lako sklopiva. Sva dodatna oprema uključena.", category: "Djeca", condition: "Jako dobro", wantedFor: "Dječje autosjedalište ili hodalica", price: null, imageUris: '["https://picsum.photos/seed/pram10/400/300"]', phone: "095 333 4455", location: "Zadar", packageSize: "large", packageBoxSize: null, daysAgo: 6 },
      { title: "Samsung Galaxy Watch 5", description: "Pametni sat, 44mm, crni. Baterija drži 40h, GPS, NFC. Sve ispravno.", category: "Elektronika", condition: "Kao novo", wantedFor: "Apple Watch ili Garmin", price: 150, imageUris: '["https://picsum.photos/seed/watch11/400/300"]', phone: null, location: "Split", packageSize: "small", packageBoxSize: "S", daysAgo: 1 },
      { title: "Teniski reket Wilson + torba", description: "Wilson Clash 100 reket + teniška torba. Žice nove, reket malo korišten.", category: "Sport", condition: "Jako dobro", wantedFor: "Badminton oprema ili squash reket", price: 120, imageUris: '["https://picsum.photos/seed/tennis12/400/300"]', phone: "091 777 8899", location: "Zagreb", packageSize: "medium", packageBoxSize: null, daysAgo: 2 },
      { title: "Kuhinjski robot Kenwood Chef", description: "Moćan kuhinjski robot 1500W s priključcima za gnječenje, miješanje, ribanje. U kutiji.", category: "Kućanstvo", condition: "Jako dobro", wantedFor: "Aparat za kavu ili blender", price: 200, imageUris: '["https://picsum.photos/seed/robot13/400/300"]', phone: "092 555 6677", location: "Varaždin", packageSize: "medium", packageBoxSize: null, daysAgo: 8 },
      { title: "Vintage Levi's 501 traperice, vel. 32", description: "Originalne vintage 501-ice, wash iz 90-ih. Odlično stanje, malo nošene.", category: "Odjeća", condition: "Jako dobro", wantedFor: "Vintage majice ili denim jakna", price: 45, imageUris: '["https://picsum.photos/seed/levis14/400/300"]', phone: null, location: "Zagreb", packageSize: "small", packageBoxSize: "M", daysAgo: 3 },
      { title: "DJI Mavic Mini 2 dron", description: "Dron u kutiji sa svim opremama. 3 baterije, punjač, torba. Letio par puta.", category: "Elektronika", condition: "Kao novo", wantedFor: "Akcijska kamera ili gimbal", price: 380, imageUris: '["https://picsum.photos/seed/drone15/400/300"]', phone: "098 999 0011", location: "Dubrovnik", packageSize: "small", packageBoxSize: "L", daysAgo: 2 },
      { title: "Bonsai drvo - ficus, 15 godina star", description: "Odrasli ficus bonsai u keramičkoj posudi. Visina 35cm. Lako ga je održavati.", category: "Vrt", condition: "Dobro", wantedFor: "Sukulenti ili kaktuski kolekcija", price: null, imageUris: '["https://picsum.photos/seed/bonsai16/400/300"]', phone: "091 100 2200", location: "Karlovac", packageSize: "medium", packageBoxSize: null, daysAgo: 10 },
      { title: "PlayStation 5 kontroler DualSense", description: "Sony PS5 kontroler, bijeli. Haptic feedback, adaptivni okidači, punjač u kutiji.", category: "Elektronika", condition: "Jako dobro", wantedFor: "Xbox kontroler ili Nintendo Switch Joy-Con", price: 70, imageUris: '["https://picsum.photos/seed/ps5ctrl17/400/300"]', phone: null, location: "Split", packageSize: "small", packageBoxSize: "M", daysAgo: 1 },
      { title: "Kožna sofa - trosjed, smeđa", description: "Kvalitetna kožna sofa, malo izlizano sjedalo ali strukturno savršeno. Dostava moguća.", category: "Namještaj", condition: "Dobro", wantedFor: "Blagovaonski stol ili stolice", price: 500, imageUris: '["https://picsum.photos/seed/sofa18/400/300"]', phone: "091 400 5500", location: "Zagreb", packageSize: "large", packageBoxSize: null, daysAgo: 12 },
      { title: "Canon EOS 250D + objektiv 18-55mm", description: "DSLR fotoaparat za početnike, 24MP. Samo 3000 okidanja. Torba i 2 baterije.", category: "Elektronika", condition: "Kao novo", wantedFor: "Mirrorless fotoaparat ili objektiv 50mm", price: 450, imageUris: '["https://picsum.photos/seed/canon19/400/300"]', phone: "092 600 7700", location: "Rijeka", packageSize: "small", packageBoxSize: "L", daysAgo: 4 },
      { title: "Snowboard komplet 155cm", description: "Snowboard 155cm + vezovi + cipele vel. 43. Korišten 2 sezone.", category: "Sport", condition: "Dobro", wantedFor: "Skije s vezovima ili splitboard", price: 280, imageUris: '["https://picsum.photos/seed/snowboard20/400/300"]', phone: "098 800 9900", location: "Zagreb", packageSize: "large", packageBoxSize: null, daysAgo: 15 },
      { title: "Saksofon alto - Yamaha YAS-280", description: "Alto saksofon za početnike i amatere. Dolazi s futrolom i notama.", category: "Glazba", condition: "Jako dobro", wantedFor: "Klavijatura ili truba", price: 350, imageUris: '["https://picsum.photos/seed/sax21/400/300"]', phone: null, location: "Osijek", packageSize: "medium", packageBoxSize: null, daysAgo: 5 },
      { title: "Survival oprema komplet", description: "Set za preživljavanje: šator 2 mjesta, vreća za spavanje -10°C, headlamp, nož.", category: "Sport", condition: "Jako dobro", wantedFor: "Kajakaška oprema ili penjačka", price: 150, imageUris: '["https://picsum.photos/seed/survival22/400/300"]', phone: "091 250 3350", location: "Karlovac", packageSize: "medium", packageBoxSize: null, daysAgo: 7 },
      { title: "Espresso aparat De'Longhi Dedica", description: "Slim dizajn, 15 bar pritisak. Savršeno kafe svaki put. U odličnom stanju.", category: "Kućanstvo", condition: "Jako dobro", wantedFor: "French press komplet ili Moka lonac set", price: 100, imageUris: '["https://picsum.photos/seed/espresso23/400/300"]', phone: null, location: "Zagreb", packageSize: "small", packageBoxSize: "L", daysAgo: 2 },
      { title: "Yoga oprema komplet - prostirka + blokovi", description: "Manduka PRO prostirka + 2 pluta bloka + remen. Sve kao novo.", category: "Sport", condition: "Kao novo", wantedFor: "Pilates oprema ili fitnes gume", price: null, imageUris: '["https://picsum.photos/seed/yoga24/400/300"]', phone: "091 350 4450", location: "Zagreb", packageSize: "medium", packageBoxSize: null, daysAgo: 3 },
      { title: "Električni romobil Xiaomi Pro 2", description: "E-romobil domet 45km, max 25km/h. Malo korišten, punjač u kutiji.", category: "Prijevoz", condition: "Jako dobro", wantedFor: "Električni bicikl ili skateboard", price: 350, imageUris: '["https://picsum.photos/seed/scooter25/400/300"]', phone: "092 450 5550", location: "Split", packageSize: "large", packageBoxSize: null, daysAgo: 6 },
      { title: "Uljana slika - apstraktan motiv 80x60cm", description: "Ručno rađena uljana slika na platnu. Savršeno za dnevni boravak.", category: "Umjetnost", condition: "Kao novo", wantedFor: "Skulptura ili fotografska grafika", price: 80, imageUris: '["https://picsum.photos/seed/painting26/400/300"]', phone: null, location: "Zagreb", packageSize: "medium", packageBoxSize: null, daysAgo: 9 },
      { title: "3D printer - Prusa Mini+", description: "Prusa Mini+ build volume 18x18x18cm. Malo korišten, kalibriran. Filament uključen.", category: "Elektronika", condition: "Jako dobro", wantedFor: "CNC glodalica ili laser gravir", price: 400, imageUris: '["https://picsum.photos/seed/printer27/400/300"]', phone: "091 550 6650", location: "Zagreb", packageSize: "medium", packageBoxSize: null, daysAgo: 5 },
      { title: "Kolekcija LEGO Star Wars - 5 setova", description: "5 složenih LEGO setova SW, sve figure, uputstva, originalne kutije. Bez nedostajućih dijelova.", category: "Igračke", condition: "Jako dobro", wantedFor: "LEGO Technic ili kolekcija Funko Pop", price: 220, imageUris: '["https://picsum.photos/seed/lego28/400/300"]', phone: null, location: "Varaždin", packageSize: "medium", packageBoxSize: null, daysAgo: 4 },
    ];

    let seeded = 0;
    for (const l of demoListings) {
      if (existingTitles.has(l.title)) continue;
      const createdAt = new Date(Date.now() - l.daysAgo * 86400000);
      await db.insert(listingsTable).values({
        id: randomUUID(),
        userId: DEMO_USER_ID,
        title: l.title,
        description: l.description,
        category: l.category,
        condition: l.condition,
        wantedFor: l.wantedFor,
        price: l.price ?? undefined,
        imageUris: l.imageUris,
        phone: l.phone ?? undefined,
        location: l.location,
        packageSize: l.packageSize,
        packageBoxSize: l.packageBoxSize ?? undefined,
        status: "active",
        moderationStatus: "active",
        createdAt,
        updatedAt: createdAt,
      });
      seeded++;
    }
    logger.info({ count: seeded }, "Seeded demo listings on first start");
  } catch (err) {
    logger.warn({ err }, "Demo seed skipped or failed");
  }
}

app.listen(port, async (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");
  await seedIfEmpty();
  await initStripe();
});
