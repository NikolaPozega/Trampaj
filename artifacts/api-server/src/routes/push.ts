import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

/**
 * POST /api/push/token
 * Sprema Expo push token za prijavljenog korisnika.
 */
router.post("/token", requireAuth, async (req: AuthRequest, res) => {
  const { token } = req.body as { token?: string };
  if (!token || typeof token !== "string" || token.trim().length < 10) {
    return res.status(400).json({ error: "Neispravan push token." });
  }
  try {
    await db.update(usersTable)
      .set({ pushToken: token })
      .where(eq(usersTable.id, req.userId!));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "push token save error");
    return res.status(500).json({ error: "Greška" });
  }
});

/**
 * DELETE /api/push/token
 * Briše push token (odjava).
 */
router.delete("/token", requireAuth, async (req: AuthRequest, res) => {
  try {
    await db.update(usersTable)
      .set({ pushToken: null })
      .where(eq(usersTable.id, req.userId!));
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "push token delete error");
    return res.status(500).json({ error: "Greška" });
  }
});

export default router;
