import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { eq, and, desc } from "drizzle-orm";
import { db, reviewsTable, usersTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

// GET /api/reviews/user/:username
router.get("/reviews/user/:username", async (req, res) => {
  const { username } = req.params as { username: string };
  try {
    const [user] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.username, username)).limit(1);
    if (!user) { res.status(404).json({ error: "Korisnik nije pronađen" }); return; }

    const rows = await db
      .select({ review: reviewsTable, authorName: usersTable.username })
      .from(reviewsTable)
      .innerJoin(usersTable, eq(reviewsTable.authorId, usersTable.id))
      .where(eq(reviewsTable.targetUserId, user.id))
      .orderBy(desc(reviewsTable.createdAt));

    res.json({
      reviews: rows.map((r) => ({
        id: r.review.id,
        targetUserName: username,
        authorName: r.authorName,
        stars: r.review.stars,
        comment: r.review.comment,
        createdAt: r.review.createdAt.getTime(),
      })),
    });
  } catch (err) {
    (req as AuthRequest).log?.error({ err }, "reviews get error");
    res.status(500).json({ error: "Greška" });
  }
});

// POST /api/reviews
router.post("/reviews", requireAuth, async (req: AuthRequest, res) => {
  const { targetUserName, stars, comment } = req.body as { targetUserName?: string; stars?: number; comment?: string };

  if (!targetUserName || typeof stars !== "number" || stars < 1 || stars > 5) {
    res.status(400).json({ error: "targetUserName i stars (1-5) su obavezni" });
    return;
  }

  try {
    const [target] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.username, targetUserName)).limit(1);
    if (!target) { res.status(404).json({ error: "Korisnik nije pronađen" }); return; }
    if (target.id === req.userId) { res.status(400).json({ error: "Ne možeš ocijeniti sebe" }); return; }

    const [existing] = await db.select({ id: reviewsTable.id }).from(reviewsTable)
      .where(and(eq(reviewsTable.targetUserId, target.id), eq(reviewsTable.authorId, req.userId!)))
      .limit(1);
    if (existing) { res.status(409).json({ error: "Već si ostavio/la recenziju za ovog korisnika" }); return; }

    const id = randomUUID();
    await db.insert(reviewsTable).values({
      id,
      targetUserId: target.id,
      authorId: req.userId!,
      stars: Math.round(stars),
      comment: comment?.trim() ?? "",
    });

    res.status(201).json({ ok: true, id });
  } catch (err) {
    req.log.error({ err }, "review post error");
    res.status(500).json({ error: "Greška" });
  }
});

export default router;
