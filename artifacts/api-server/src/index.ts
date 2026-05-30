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
    if ((row?.c ?? 0) > 0) return;

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

    const demoListings = [
      { title: "Sony slušalice WH-1000XM4", description: "Odlične slušalice s redukcijom buke, malo korištene. U originalnoj kutiji, sve ispravno radi.", category: "Elektronika", condition: "Jako dobro", wantedFor: "Bežična tipkovnica ili miš visokog kvaliteta", price: 180, imageUris: '["https://picsum.photos/seed/headphones1/400/300"]', phone: "091 123 4567", location: "Zagreb", packageSize: "small", packageBoxSize: "M" },
      { title: "Zimska jakna XL, North Face", description: "Topla zimska jakna, nosio je jednu sezonu. Boja tamno plava, odlično stanje.", category: "Odjeća", condition: "Jako dobro", wantedFor: "Ljetna jakna ili sportska oprema", price: null, imageUris: '["https://picsum.photos/seed/jacket2/400/300"]', phone: null, location: "Split", packageSize: "small", packageBoxSize: "M" },
      { title: "Skup knjiga - fantazija (10 knjiga)", description: "Komplet knjiga Patricka Rothfussa i Brandona Sandersona. Sve u odličnom stanju.", category: "Knjige", condition: "Kao novo", wantedFor: "Sci-fi knjige ili stripovi", price: 60, imageUris: '["https://picsum.photos/seed/books3/400/300"]', phone: "095 765 4321", location: "Rijeka", packageSize: "medium", packageBoxSize: null },
      { title: "Bicikl - gradski, 26\"", description: "Gradski bicikl, servisiran prošle godine. Nova guma naprijed. Boja srebrna.", category: "Sport", condition: "Dobro", wantedFor: "Roleri ili električni romobil", price: 350, imageUris: '["https://picsum.photos/seed/bicycle4/400/300"]', phone: "098 111 2233", location: "Osijek", packageSize: "large", packageBoxSize: null },
      { title: "Stolna lampa - industrijski stil", description: "Metalna lampa, crna boja, LED žarulja uključena. Idealna za radni stol.", category: "Namještaj", condition: "Dobro", wantedFor: "Polica za knjige ili mali stol", price: null, imageUris: '["https://picsum.photos/seed/lamp5/400/300"]', phone: null, location: "Zagreb", packageSize: "medium", packageBoxSize: null },
      { title: "Roleri Rollerblade, vel. 42", description: "Inline roleri u odličnom stanju, korišteni svega par puta. Kaciga uključena.", category: "Sport", condition: "Kao novo", wantedFor: "Bicikl gradski ili električni romobil", price: 120, imageUris: '["https://picsum.photos/seed/skates6/400/300"]', phone: "091 555 7788", location: "Zagreb", packageSize: "small", packageBoxSize: "L" },
      { title: "Bežični miš Logitech MX Master 3", description: "Premium miš, ergonomski, savršen za dugotrajni rad. Baterija traje 70 dana.", category: "Elektronika", condition: "Jako dobro", wantedFor: "Mehanička tipkovnica ili slušalice", price: 90, imageUris: '["https://picsum.photos/seed/mouse7/400/300"]', phone: null, location: "Zagreb", packageSize: "small", packageBoxSize: "S" },
      { title: "iPad 9. generacija, 64GB", description: "iPad u odličnom stanju, s torbom i punjačem. Bez ogrebotina na ekranu.", category: "Elektronika", condition: "Jako dobro", wantedFor: "Laptop ili MacBook bilo koje generacije", price: 300, imageUris: '["https://picsum.photos/seed/ipad9/400/300"]', phone: "098 444 5566", location: "Zagreb", packageSize: "small", packageBoxSize: "S" },
    ];

    for (const l of demoListings) {
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
      });
    }
    logger.info({ count: demoListings.length }, "Seeded demo listings on first start");
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
