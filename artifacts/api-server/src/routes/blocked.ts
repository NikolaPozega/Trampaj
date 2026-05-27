import { Router, type IRouter } from "express";
import { eq, and } from "drizzle-orm";
import { db, blockedUsersTable, usersTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router: IRouter = Router();

// GET /api/blocked
router.get("/blocked", requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select({ username: usersTable.username })
      .from(blockedUsersTable)
      .innerJoin(usersTable, eq(blockedUsersTable.blockedUserId, usersTable.id))
      .where(eq(blockedUsersTable.userId, req.userId!));
    res.json({ blockedUserNames: rows.map((r) => r.username) });
  } catch (err) {
    req.log.error({ err }, "blocked get error");
    res.status(500).json({ error: "Greška" });
  }
});

// POST /api/blocked
router.post("/blocked", requireAuth, async (req: AuthRequest, res) => {
  const { username } = req.body as { username?: string };
  if (!username) { res.status(400).json({ error: "username je obavezan" }); return; }
  try {
    const [user] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.username, username)).limit(1);
    if (!user) { res.status(404).json({ error: "Korisnik nije pronađen" }); return; }
    if (user.id === req.userId) { res.status(400).json({ error: "Ne možeš blokirati sebe" }); return; }

    await db.insert(blockedUsersTable).values({ userId: req.userId!, blockedUserId: user.id })
      .onConflictDoNothing();
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "blocked post error");
    res.status(500).json({ error: "Greška" });
  }
});

// DELETE /api/blocked/:username
router.delete("/blocked/:username", requireAuth, async (req: AuthRequest, res) => {
  const { username } = req.params as { username: string };
  try {
    const [user] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.username, username)).limit(1);
    if (!user) { res.json({ ok: true }); return; }

    await db.delete(blockedUsersTable).where(
      and(eq(blockedUsersTable.userId, req.userId!), eq(blockedUsersTable.blockedUserId, user.id))
    );
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "blocked delete error");
    res.status(500).json({ error: "Greška" });
  }
});

export default router;
