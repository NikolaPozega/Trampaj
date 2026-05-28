import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { eq, and, or, ilike, desc, getTableColumns } from "drizzle-orm";
import { db, listingsTable, usersTable, savedListingsTable } from "@workspace/db";
import { requireAuth, optionalAuth, type AuthRequest } from "../middlewares/auth";
import { moderateListing } from "../moderationService";

const router: IRouter = Router();

interface ListingRow {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  condition: string | null;
  wantedFor: string;
  price: number | null;
  imageUris: string;
  phone: string | null;
  location: string;
  status: string;
  moderationStatus: string;
  topup: string | null;
  flexibility: string | null;
  cashFallback: boolean | null;
  deadline: string | null;
  nudimTags: string;
  trazimTags: string;
  packageSize: string | null;
  packageBoxSize: string | null;
  packageWeight: number | null;
  createdAt: Date;
  updatedAt: Date;
  userName: string;
}

function parseListing(row: ListingRow, currentUserId?: string) {
  return {
    id: row.id,
    userId: row.userId,
    userName: row.userName,
    title: row.title,
    description: row.description,
    category: row.category,
    condition: row.condition,
    wantedFor: row.wantedFor,
    price: row.price,
    imageUris: (() => { try { return JSON.parse(row.imageUris) as string[]; } catch { return []; } })(),
    phone: row.phone,
    location: row.location,
    status: row.status,
    topup: row.topup,
    flexibility: row.flexibility,
    cashFallback: row.cashFallback,
    deadline: row.deadline,
    nudimTags: (() => { try { return JSON.parse(row.nudimTags) as string[]; } catch { return []; } })(),
    trazimTags: (() => { try { return JSON.parse(row.trazimTags) as string[]; } catch { return []; } })(),
    packageSize: row.packageSize,
    packageBoxSize: row.packageBoxSize,
    packageWeight: row.packageWeight,
    createdAt: row.createdAt.getTime(),
    isMine: row.userId === (currentUserId ?? "__none__"),
    moderationStatus: row.moderationStatus,
  };
}

const listingCols = getTableColumns(listingsTable);
const listingFields = { ...listingCols, userName: usersTable.username };

// GET /api/listings
router.get("/listings", optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { category, search, status } = req.query as Record<string, string | undefined>;

    const conditions = [];
    if (status && status !== "all") {
      conditions.push(eq(listingsTable.status, status));
    } else if (!status) {
      conditions.push(eq(listingsTable.status, "active"));
    }
    // Public feed shows only AI-approved listings
    conditions.push(eq(listingsTable.moderationStatus, "active"));
    if (category && category !== "Sve") {
      conditions.push(eq(listingsTable.category, category));
    }
    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      conditions.push(or(
        ilike(listingsTable.title, term),
        ilike(listingsTable.description, term),
        ilike(listingsTable.wantedFor, term),
      ));
    }

    const rows = await db
      .select(listingFields)
      .from(listingsTable)
      .innerJoin(usersTable, eq(listingsTable.userId, usersTable.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(listingsTable.createdAt)) as ListingRow[];

    res.json({ listings: rows.map((r) => parseListing(r, req.userId)) });
  } catch (err) {
    req.log.error({ err }, "listings list error");
    res.status(500).json({ error: "Greška pri dohvatu oglasa" });
  }
});

// GET /api/listings/by-user/:username
router.get("/listings/by-user/:username", optionalAuth, async (req: AuthRequest, res) => {
  const { username } = req.params as { username: string };
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username)).limit(1);
    if (!user) { res.status(404).json({ error: "Korisnik nije pronađen" }); return; }

    const rows = await db
      .select(listingFields)
      .from(listingsTable)
      .innerJoin(usersTable, eq(listingsTable.userId, usersTable.id))
      .where(eq(listingsTable.userId, user.id))
      .orderBy(desc(listingsTable.createdAt)) as ListingRow[];

    res.json({ listings: rows.map((r) => parseListing(r, req.userId)) });
  } catch (err) {
    req.log.error({ err }, "listings by-user error");
    res.status(500).json({ error: "Greška pri dohvatu oglasa" });
  }
});

// GET /api/listings/:id
router.get("/listings/:id", optionalAuth, async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };
  try {
    const [row] = await db
      .select(listingFields)
      .from(listingsTable)
      .innerJoin(usersTable, eq(listingsTable.userId, usersTable.id))
      .where(eq(listingsTable.id, id))
      .limit(1) as ListingRow[];

    if (!row) { res.status(404).json({ error: "Oglas nije pronađen" }); return; }
    res.json({ listing: parseListing(row, req.userId) });
  } catch (err) {
    req.log.error({ err }, "listing get error");
    res.status(500).json({ error: "Greška pri dohvatu oglasa" });
  }
});

// POST /api/listings
router.post("/listings", requireAuth, async (req: AuthRequest, res) => {
  const {
    title, description, category, condition, wantedFor, price,
    imageUris, phone, location, topup, flexibility, cashFallback, deadline,
    nudimTags, trazimTags, packageSize, packageBoxSize, packageWeight,
  } = req.body as Record<string, unknown>;

  if (!title || !description || !category) {
    res.status(400).json({ error: "Naslov, opis i kategorija su obavezni" });
    return;
  }

  try {
    const id = randomUUID();
    const imgs = Array.isArray(imageUris) ? imageUris as string[] : [];

    // Start with 'pending' if OpenAI key exists, otherwise 'active'
    const initialModerationStatus = process.env["OPENAI_API_KEY"] ? "pending" : "active";

    await db.insert(listingsTable).values({
      id,
      userId: req.userId!,
      title: String(title),
      description: String(description),
      category: String(category),
      condition: condition ? String(condition) : null,
      wantedFor: wantedFor ? String(wantedFor) : "",
      price: typeof price === "number" ? price : null,
      imageUris: JSON.stringify(imgs),
      phone: phone ? String(phone) : null,
      location: location ? String(location) : "",
      topup: topup ? String(topup) : null,
      flexibility: flexibility ? String(flexibility) : null,
      cashFallback: typeof cashFallback === "boolean" ? cashFallback : null,
      deadline: deadline ? String(deadline) : null,
      nudimTags: JSON.stringify(Array.isArray(nudimTags) ? nudimTags : []),
      trazimTags: JSON.stringify(Array.isArray(trazimTags) ? trazimTags : []),
      packageSize: packageSize ? String(packageSize) : null,
      packageBoxSize: packageBoxSize ? String(packageBoxSize) : null,
      packageWeight: typeof packageWeight === "number" ? packageWeight : null,
      moderationStatus: initialModerationStatus,
    });

    // Async AI moderation — ne blokira odgovor
    if (process.env["OPENAI_API_KEY"]) {
      setImmediate(async () => {
        try {
          const result = await moderateListing(
            String(title), String(description), wantedFor ? String(wantedFor) : "", imgs,
          );
          await db.update(listingsTable)
            .set({ moderationStatus: result.status, moderationNote: result.note })
            .where(eq(listingsTable.id, id));
        } catch { /* silent */ }
      });
    }

    const [row] = await db
      .select(listingFields)
      .from(listingsTable)
      .innerJoin(usersTable, eq(listingsTable.userId, usersTable.id))
      .where(eq(listingsTable.id, id))
      .limit(1) as ListingRow[];

    res.status(201).json({ listing: parseListing(row!, req.userId) });
  } catch (err) {
    req.log.error({ err }, "listing create error");
    res.status(500).json({ error: "Greška pri kreiranju oglasa" });
  }
});

// PUT /api/listings/:id
router.put("/listings/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };
  const { title, description, wantedFor, price, category, location, condition } = req.body as Record<string, unknown>;

  try {
    const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, id)).limit(1);
    if (!listing) { res.status(404).json({ error: "Oglas nije pronađen" }); return; }
    if (listing.userId !== req.userId) { res.status(403).json({ error: "Nemaš pravo uređivati ovaj oglas" }); return; }

    const updates: Partial<typeof listingsTable.$inferInsert> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = String(title);
    if (description !== undefined) updates.description = String(description);
    if (wantedFor !== undefined) updates.wantedFor = String(wantedFor);
    if (price !== undefined) updates.price = typeof price === "number" ? price : null;
    if (category !== undefined) updates.category = String(category);
    if (location !== undefined) updates.location = String(location);
    if (condition !== undefined) updates.condition = condition ? String(condition) : null;

    await db.update(listingsTable).set(updates).where(eq(listingsTable.id, id));

    const [row] = await db
      .select(listingFields)
      .from(listingsTable)
      .innerJoin(usersTable, eq(listingsTable.userId, usersTable.id))
      .where(eq(listingsTable.id, id))
      .limit(1) as ListingRow[];

    res.json({ listing: parseListing(row!, req.userId) });
  } catch (err) {
    req.log.error({ err }, "listing update error");
    res.status(500).json({ error: "Greška pri ažuriranju oglasa" });
  }
});

// PATCH /api/listings/:id/status
router.patch("/listings/:id/status", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };
  const { status } = req.body as { status?: string };

  if (status !== "active" && status !== "traded") {
    res.status(400).json({ error: "Status mora biti 'active' ili 'traded'" });
    return;
  }
  try {
    const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, id)).limit(1);
    if (!listing) { res.status(404).json({ error: "Oglas nije pronađen" }); return; }
    if (listing.userId !== req.userId) { res.status(403).json({ error: "Nemaš pravo" }); return; }
    await db.update(listingsTable).set({ status, updatedAt: new Date() }).where(eq(listingsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "listing status error");
    res.status(500).json({ error: "Greška" });
  }
});

// DELETE /api/listings/:id
router.delete("/listings/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };
  try {
    const [listing] = await db.select().from(listingsTable).where(eq(listingsTable.id, id)).limit(1);
    if (!listing) { res.status(404).json({ error: "Oglas nije pronađen" }); return; }
    if (listing.userId !== req.userId) { res.status(403).json({ error: "Nemaš pravo" }); return; }
    await db.delete(listingsTable).where(eq(listingsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "listing delete error");
    res.status(500).json({ error: "Greška pri brisanju" });
  }
});

// GET /api/saved
router.get("/saved", requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db.select({ listingId: savedListingsTable.listingId })
      .from(savedListingsTable)
      .where(eq(savedListingsTable.userId, req.userId!));
    res.json({ savedIds: rows.map((r) => r.listingId) });
  } catch (err) {
    req.log.error({ err }, "saved get error");
    res.status(500).json({ error: "Greška" });
  }
});

// POST /api/saved/:listingId
router.post("/saved/:listingId", requireAuth, async (req: AuthRequest, res) => {
  const { listingId } = req.params as { listingId: string };
  try {
    await db.insert(savedListingsTable).values({ userId: req.userId!, listingId }).onConflictDoNothing();
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "saved post error");
    res.status(500).json({ error: "Greška" });
  }
});

// DELETE /api/saved/:listingId
router.delete("/saved/:listingId", requireAuth, async (req: AuthRequest, res) => {
  const { listingId } = req.params as { listingId: string };
  try {
    await db.delete(savedListingsTable).where(
      and(eq(savedListingsTable.userId, req.userId!), eq(savedListingsTable.listingId, listingId))
    );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "saved delete error");
    res.status(500).json({ error: "Greška" });
  }
});

export default router;
