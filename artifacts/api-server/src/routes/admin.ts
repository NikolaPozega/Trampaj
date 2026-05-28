import { Router, type Request, type Response, type NextFunction } from "express";
import { eq, desc, count, and, sql, gte } from "drizzle-orm";
import { db, listingsTable, usersTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

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

export default router;
