import { Router, type Request, type Response, type NextFunction } from "express";
import { eq, desc, count, and, sql, gte } from "drizzle-orm";
import { db, listingsTable, usersTable, socialPostsTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";

const router = Router();

// ─── requireAdmin middleware ─────────────────────────────────────────────────
function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  requireAuth(req as AuthRequest, res, async () => {
    try {
      const userId = (req as AuthRequest).userId!;
      const [user] = await db.select({ isAdmin: usersTable.isAdmin })
        .from(usersTable).where(eq(usersTable.id, userId)).limit(1);
      if (!user?.isAdmin) {
        res.status(403).json({ error: "Nedovoljne ovlasti." });
        return;
      }
      next();
    } catch {
      res.status(500).json({ error: "Greška provjere ovlasti." });
    }
  });
}

// ─── GET /api/admin/stats ────────────────────────────────────────────────────
router.get("/stats", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      [totalListings], [pendingListings], [totalUsers], [bannedUsers],
      [activeListings], [rejectedListings],
      [newListings7d], [newUsers7d], [newUsers30d],
      [earlyAdoptersRow],
      categoryRows, cityRows,
    ] = await Promise.all([
      db.select({ c: count() }).from(listingsTable),
      db.select({ c: count() }).from(listingsTable).where(eq(listingsTable.moderationStatus, "pending")),
      db.select({ c: count() }).from(usersTable),
      db.select({ c: count() }).from(usersTable).where(eq(usersTable.isBanned, true)),
      db.select({ c: count() }).from(listingsTable).where(and(eq(listingsTable.status, "active"), eq(listingsTable.moderationStatus, "active"))),
      db.select({ c: count() }).from(listingsTable).where(eq(listingsTable.moderationStatus, "rejected")),
      db.select({ c: count() }).from(listingsTable).where(gte(listingsTable.createdAt, sevenDaysAgo)),
      db.select({ c: count() }).from(usersTable).where(gte(usersTable.createdAt, sevenDaysAgo)),
      db.select({ c: count() }).from(usersTable).where(gte(usersTable.createdAt, thirtyDaysAgo)),
      db.select({ c: count() }).from(usersTable).where(eq(usersTable.earlyAdopter, true)),
      db.select({ category: listingsTable.category, cnt: count() }).from(listingsTable)
        .groupBy(listingsTable.category).orderBy(desc(count())).limit(8),
      db.select({ location: listingsTable.location, cnt: count() }).from(listingsTable)
        .where(sql`${listingsTable.location} != ''`)
        .groupBy(listingsTable.location).orderBy(desc(count())).limit(6),
    ]);

    const total = totalListings?.c ?? 0;
    const approved = activeListings?.c ?? 0;
    const rejected = rejectedListings?.c ?? 0;
    const moderated = approved + rejected;
    const approvalRate = moderated > 0 ? Math.round((approved / moderated) * 100) : null;

    return res.json({
      totalListings: total,
      activeListings: approved,
      pendingListings: pendingListings?.c ?? 0,
      rejectedListings: rejected,
      totalUsers: totalUsers?.c ?? 0,
      bannedUsers: bannedUsers?.c ?? 0,
      newListings7d: newListings7d?.c ?? 0,
      newUsers7d: newUsers7d?.c ?? 0,
      newUsers30d: newUsers30d?.c ?? 0,
      approvalRate,
      earlyAdopters: earlyAdoptersRow?.c ?? 0,
      categoryBreakdown: categoryRows.map(r => ({ category: r.category, count: r.cnt })),
      topCities: cityRows.map(r => ({ city: r.location, count: r.cnt })),
    });
  } catch (err) {
    req.log.error({ err }, "admin stats error");
    return res.status(500).json({ error: "Greška" });
  }
});

// ─── GET /api/admin/listings ─────────────────────────────────────────────────
router.get("/listings", requireAdmin, async (req: AuthRequest, res) => {
  const status = (req.query["status"] as string) ?? "pending";
  try {
    const rows = await db
      .select({
        id: listingsTable.id,
        title: listingsTable.title,
        category: listingsTable.category,
        status: listingsTable.status,
        moderationStatus: listingsTable.moderationStatus,
        moderationNote: listingsTable.moderationNote,
        imageUris: listingsTable.imageUris,
        createdAt: listingsTable.createdAt,
        userName: usersTable.username,
        userId: usersTable.id,
      })
      .from(listingsTable)
      .innerJoin(usersTable, eq(listingsTable.userId, usersTable.id))
      .where(eq(listingsTable.moderationStatus, status))
      .orderBy(desc(listingsTable.createdAt))
      .limit(100);

    return res.json({
      listings: rows.map((r) => ({
        ...r,
        imageUris: (() => { try { return JSON.parse(r.imageUris) as string[]; } catch { return []; } })(),
        createdAt: r.createdAt.getTime(),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "admin listings error");
    return res.status(500).json({ error: "Greška" });
  }
});

// ─── PATCH /api/admin/listings/:id ──────────────────────────────────────────
router.patch("/listings/:id", requireAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };
  const { moderationStatus, moderationNote } = req.body as {
    moderationStatus?: "active" | "pending" | "rejected";
    moderationNote?: string;
  };

  if (!moderationStatus || !["active", "pending", "rejected"].includes(moderationStatus)) {
    return res.status(400).json({ error: "Neispravan moderationStatus." });
  }

  try {
    await db.update(listingsTable)
      .set({ moderationStatus, moderationNote: moderationNote ?? null })
      .where(eq(listingsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "admin listing patch error");
    return res.status(500).json({ error: "Greška" });
  }
});

// ─── GET /api/admin/users ────────────────────────────────────────────────────
router.get("/users", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const users = await db
      .select({
        id: usersTable.id,
        username: usersTable.username,
        email: usersTable.email,
        isAdmin: usersTable.isAdmin,
        isBanned: usersTable.isBanned,
        isVerified: usersTable.isVerified,
        createdAt: usersTable.createdAt,
      })
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt))
      .limit(500);

    return res.json({
      users: users.map((u) => ({ ...u, createdAt: u.createdAt.getTime() })),
    });
  } catch (err) {
    req.log.error({ err }, "admin users error");
    return res.status(500).json({ error: "Greška" });
  }
});

// ─── PATCH /api/admin/users/:id ─────────────────────────────────────────────
router.patch("/users/:id", requireAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };
  const { isBanned, isAdmin } = req.body as { isBanned?: boolean; isAdmin?: boolean };

  const update: Record<string, boolean> = {};
  if (typeof isBanned === "boolean") update["isBanned"] = isBanned;
  if (typeof isAdmin === "boolean") update["isAdmin"] = isAdmin;

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ error: "Nema promjena." });
  }

  try {
    await db.update(usersTable).set(update).where(eq(usersTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "admin user patch error");
    return res.status(500).json({ error: "Greška" });
  }
});

// ─── DELETE /api/admin/listings/:id ─────────────────────────────────────────
router.delete("/listings/:id", requireAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };
  try {
    await db.delete(listingsTable).where(eq(listingsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "admin listing delete error");
    return res.status(500).json({ error: "Greška" });
  }
});

// ─── GET /api/admin/activity ─────────────────────────────────────────────────
router.get("/activity", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const limit = 20;
    const [recentUsers, recentListings, pendingRows] = await Promise.all([
      db.select({ id: usersTable.id, username: usersTable.username, email: usersTable.email, createdAt: usersTable.createdAt })
        .from(usersTable).orderBy(desc(usersTable.createdAt)).limit(limit),
      db.select({ id: listingsTable.id, title: listingsTable.title, moderationStatus: listingsTable.moderationStatus, status: listingsTable.status, createdAt: listingsTable.createdAt })
        .from(listingsTable).orderBy(desc(listingsTable.createdAt)).limit(limit),
      db.select({ c: count() }).from(listingsTable).where(eq(listingsTable.moderationStatus, "pending")),
    ]);

    const events: { type: string; label: string; sub: string; ts: number; link?: string }[] = [];

    for (const u of recentUsers) {
      events.push({ type: "user", label: `Novi korisnik: ${u.username}`, sub: u.email, ts: u.createdAt.getTime() });
    }
    for (const l of recentListings) {
      const badge = l.moderationStatus === "pending" ? "⏳ čeka moderaciju" : l.moderationStatus === "rejected" ? "❌ odbijen" : "✅ aktivan";
      events.push({ type: "listing", label: l.title, sub: badge, ts: l.createdAt.getTime(), link: `/listings` });
    }

    events.sort((a, b) => b.ts - a.ts);

    res.json({ events: events.slice(0, 30), pendingCount: pendingRows[0]?.c ?? 0 });
  } catch (err) {
    req.log.error({ err }, "admin activity error");
    res.status(500).json({ error: "Greška" });
  }
});

// ─── POST /api/admin/seed-demo ───────────────────────────────────────────────
// Idempotent — safe to call multiple times; uses ON CONFLICT DO NOTHING
router.post("/seed-demo", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";
    const DEMO_EMAIL = "demo@trampaj.hr";

    // Create or skip demo user
    const existing = await db.select({ id: usersTable.id })
      .from(usersTable).where(eq(usersTable.id, DEMO_USER_ID)).limit(1);

    if (existing.length === 0) {
      const passwordHash = await bcrypt.hash("TrampaDemo2025!", 12);
      await db.insert(usersTable).values({
        id: DEMO_USER_ID,
        username: "TrampaDemo",
        email: DEMO_EMAIL,
        passwordHash,
        isVerified: true,
      });
    }

    const demoListings = [
      { id: randomUUID(), title: "Sony slušalice WH-1000XM4", description: "Odlične slušalice s redukcijom buke, malo korištene. U originalnoj kutiji, sve ispravno radi.", category: "Elektronika", condition: "Jako dobro", wantedFor: "Bežična tipkovnica ili miš visokog kvaliteta", price: 180, imageUris: JSON.stringify(["https://picsum.photos/seed/headphones1/400/300"]), phone: "091 123 4567", location: "Zagreb", packageSize: "small", packageBoxSize: "M" },
      { id: randomUUID(), title: "Zimska jakna XL, North Face", description: "Topla zimska jakna, nosio je jednu sezonu. Boja tamno plava, odlično stanje.", category: "Odjeća", condition: "Jako dobro", wantedFor: "Ljetna jakna ili sportska oprema", price: null, imageUris: JSON.stringify(["https://picsum.photos/seed/jacket2/400/300"]), phone: null, location: "Split", packageSize: "small", packageBoxSize: "M" },
      { id: randomUUID(), title: "Skup knjiga - fantazija (10 knjiga)", description: "Komplet knjiga Patricka Rothfussa i Brandona Sandersona. Sve u odličnom stanju.", category: "Knjige", condition: "Kao novo", wantedFor: "Sci-fi knjige ili stripovi", price: 60, imageUris: JSON.stringify(["https://picsum.photos/seed/books3/400/300"]), phone: "095 765 4321", location: "Rijeka", packageSize: "medium", packageBoxSize: null },
      { id: randomUUID(), title: "Bicikl - gradski, 26\"", description: "Gradski bicikl, servisiran prošle godine. Nova guma naprijed. Boja srebrna.", category: "Sport", condition: "Dobro", wantedFor: "Roleri ili električni romobil", price: 350, imageUris: JSON.stringify(["https://picsum.photos/seed/bicycle4/400/300"]), phone: "098 111 2233", location: "Osijek", packageSize: "large", packageBoxSize: null },
      { id: randomUUID(), title: "Stolna lampa - industrijski stil", description: "Metalna lampa, crna boja, LED žarulja uključena. Idealna za radni stol.", category: "Namještaj", condition: "Dobro", wantedFor: "Polica za knjige ili mali stol", price: null, imageUris: JSON.stringify(["https://picsum.photos/seed/lamp5/400/300"]), phone: null, location: "Zagreb", packageSize: "medium", packageBoxSize: null },
      { id: randomUUID(), title: "Roleri Rollerblade, vel. 42", description: "Inline roleri u odličnom stanju, korišteni svega par puta. Kaciga uključena.", category: "Sport", condition: "Kao novo", wantedFor: "Bicikl gradski ili električni romobil", price: 120, imageUris: JSON.stringify(["https://picsum.photos/seed/skates6/400/300"]), phone: "091 555 7788", location: "Zagreb", packageSize: "small", packageBoxSize: "L" },
      { id: randomUUID(), title: "Bežični miš Logitech MX Master 3", description: "Premium miš, ergonomski, savršen za dugotrajni rad. Baterija traje 70 dana.", category: "Elektronika", condition: "Jako dobro", wantedFor: "Mehanička tipkovnica ili slušalice", price: 90, imageUris: JSON.stringify(["https://picsum.photos/seed/mouse7/400/300"]), phone: null, location: "Zagreb", packageSize: "small", packageBoxSize: "S" },
      { id: randomUUID(), title: "iPad 9. generacija, 64GB", description: "iPad u odličnom stanju, s torbom i punjačem. Bez ogrebotina na ekranu.", category: "Elektronika", condition: "Jako dobro", wantedFor: "Laptop ili MacBook bilo koje generacije", price: 300, imageUris: JSON.stringify(["https://picsum.photos/seed/ipad9/400/300"]), phone: "098 444 5566", location: "Zagreb", packageSize: "small", packageBoxSize: "S" },
    ];

    let inserted = 0;
    for (const l of demoListings) {
      const exists = await db.select({ id: listingsTable.id })
        .from(listingsTable).where(eq(listingsTable.title, l.title)).limit(1);
      if (exists.length === 0) {
        await db.insert(listingsTable).values({
          id: l.id,
          userId: DEMO_USER_ID,
          title: l.title,
          description: l.description,
          category: l.category,
          condition: l.condition ?? undefined,
          wantedFor: l.wantedFor,
          price: l.price ?? undefined,
          imageUris: l.imageUris,
          phone: l.phone ?? undefined,
          location: l.location,
          packageSize: l.packageSize ?? undefined,
          packageBoxSize: l.packageBoxSize ?? undefined,
          status: "active",
          moderationStatus: "active",
        });
        inserted++;
      }
    }

    req.log.info({ inserted }, "seed-demo completed");
    return res.json({ ok: true, inserted, total: demoListings.length });
  } catch (err) {
    req.log.error({ err }, "seed-demo error");
    return res.status(500).json({ error: "Greška pri seedanju" });
  }
});

// ─── DELETE /api/admin/users/:id ─────────────────────────────────────────────
router.delete("/users/:id", requireAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };
  try {
    await db.delete(usersTable).where(eq(usersTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "admin user delete error");
    return res.status(500).json({ error: "Greška" });
  }
});

// ─── GET /api/admin/early-adopters ───────────────────────────────────────────
router.get("/early-adopters", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [users, [{ c }]] = await Promise.all([
      db.select({
        id: usersTable.id, username: usersTable.username, email: usersTable.email,
        earlyAdopter: usersTable.earlyAdopter, deliveryDiscountUsed: usersTable.deliveryDiscountUsed,
        createdAt: usersTable.createdAt,
      }).from(usersTable).where(eq(usersTable.earlyAdopter, true)).orderBy(usersTable.createdAt).limit(500),
      db.select({ c: count() }).from(usersTable).where(eq(usersTable.earlyAdopter, true)),
    ]);
    const LIMIT = 500;
    return res.json({
      count: c, limit: LIMIT, remaining: Math.max(LIMIT - c, 0),
      users: users.map(u => ({ ...u, createdAt: u.createdAt.getTime() })),
    });
  } catch (err) {
    req.log.error({ err }, "early-adopters error");
    return res.status(500).json({ error: "Greška" });
  }
});

// ─── POST /api/admin/push-broadcast ──────────────────────────────────────────
router.post("/push-broadcast", requireAdmin, async (req: AuthRequest, res) => {
  const { title, body } = req.body as { title?: string; body?: string };
  if (!title?.trim() || !body?.trim()) {
    return res.status(400).json({ error: "Naslov i poruka su obavezni." });
  }
  try {
    const users = await db.select({ pushToken: usersTable.pushToken }).from(usersTable)
      .where(sql`${usersTable.pushToken} IS NOT NULL`);
    const tokens = users.map(u => u.pushToken).filter(Boolean) as string[];

    const CHUNK = 100;
    let sent = 0, errors = 0;
    for (let i = 0; i < tokens.length; i += CHUNK) {
      const chunk = tokens.slice(i, i + CHUNK);
      try {
        const r = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "application/json" },
          body: JSON.stringify(chunk.map(to => ({ to, title: title.trim(), body: body.trim(), sound: "default", data: {} }))),
        });
        const d = await r.json() as { data?: { status: string }[] };
        for (const ticket of (d.data ?? [])) {
          if (ticket.status === "ok") sent++; else errors++;
        }
      } catch { errors += chunk.length; }
    }
    req.log.info({ sent, errors, total: tokens.length }, "push broadcast");
    return res.json({ ok: true, sent, errors, total: tokens.length });
  } catch (err) {
    req.log.error({ err }, "push broadcast error");
    return res.status(500).json({ error: "Greška" });
  }
});

// ─── POST /api/admin/social-posts/manual — ručno logiranje (TikTok) ──────────
router.post("/social-posts/manual", requireAdmin, async (req: AuthRequest, res) => {
  const { platform, postId, caption, listingId, listingTitle, imageUrl } = req.body as {
    platform?: string; postId?: string; caption?: string;
    listingId?: string; listingTitle?: string; imageUrl?: string;
  };
  if (!platform || !postId) return res.status(400).json({ error: "platform i postId su obavezni." });
  try {
    await db.insert(socialPostsTable).values({
      id: randomUUID(),
      platform: platform.toLowerCase(),
      postId: postId.trim(),
      listingId: listingId ?? null,
      listingTitle: listingTitle?.trim() ?? "",
      caption: caption?.trim() ?? "",
      imageUrl: imageUrl ?? null,
      status: "published",
    });
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "manual social post error");
    return res.status(500).json({ error: "Greška pri snimanju." });
  }
});

// ─── GET /api/admin/social-posts ─────────────────────────────────────────────
router.get("/social-posts", requireAdmin, async (req: AuthRequest, res) => {
  try {
    const posts = await db.select().from(socialPostsTable).orderBy(desc(socialPostsTable.createdAt)).limit(200);
    return res.json({ posts: posts.map(p => ({ ...p, createdAt: p.createdAt.getTime() })) });
  } catch (err) {
    req.log.error({ err }, "social posts list error");
    return res.status(500).json({ error: "Greška" });
  }
});

// helper: get page access token
async function getAdminPageToken(): Promise<string | null> {
  const pageId = process.env["META_PAGE_ID"];
  const userToken = process.env["META_PAGE_TOKEN"];
  if (!pageId || !userToken) return null;
  try {
    const r = await fetch(`https://graph.facebook.com/v19.0/${pageId}?fields=access_token&access_token=${userToken}`);
    const d = await r.json() as { access_token?: string };
    return d.access_token ?? null;
  } catch { return null; }
}

// ─── DELETE /api/admin/social-posts/:id ──────────────────────────────────────
router.delete("/social-posts/:id", requireAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };
  try {
    const [post] = await db.select().from(socialPostsTable).where(eq(socialPostsTable.id, id)).limit(1);
    if (!post) return res.status(404).json({ error: "Objava nije pronađena." });

    if (post.status === "published" && post.postId) {
      const pageToken = await getAdminPageToken();
      if (pageToken) {
        try {
          await fetch(`https://graph.facebook.com/v19.0/${post.postId}?access_token=${pageToken}`, { method: "DELETE" });
        } catch { /* ignore platform errors */ }
      }
    }
    await db.update(socialPostsTable).set({ status: "deleted" }).where(eq(socialPostsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "social post delete error");
    return res.status(500).json({ error: "Greška" });
  }
});

// ─── PATCH /api/admin/social-posts/:id ───────────────────────────────────────
router.patch("/social-posts/:id", requireAdmin, async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };
  const { caption } = req.body as { caption?: string };
  if (!caption?.trim()) return res.status(400).json({ error: "Nema teksta." });
  try {
    const [post] = await db.select().from(socialPostsTable).where(eq(socialPostsTable.id, id)).limit(1);
    if (!post) return res.status(404).json({ error: "Objava nije pronađena." });
    if (post.platform !== "facebook") return res.status(400).json({ error: "Uređivanje dostupno samo za Facebook." });

    const pageToken = await getAdminPageToken();
    if (pageToken && post.postId) {
      const r = await fetch(`https://graph.facebook.com/v19.0/${post.postId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: caption.trim(), access_token: pageToken }),
      });
      const d = await r.json() as { error?: { message: string } };
      if (d.error) return res.status(400).json({ error: d.error.message });
    }
    await db.update(socialPostsTable).set({ caption: caption.trim() }).where(eq(socialPostsTable.id, id));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "social post patch error");
    return res.status(500).json({ error: "Greška" });
  }
});


export default router;
