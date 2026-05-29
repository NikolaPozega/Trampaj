import { Router, type IRouter } from "express";
import { postToFacebook, postToInstagram } from "../lib/socialMedia";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// POST /api/social/test — testna objava (samo admin)
router.post("/social/test", async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ ok: false, message: "Nema autorizacije." });
    return;
  }

  const testListing = {
    id: "test-123",
    title: "Test oglas — Trampaj.hr",
    wantedFor: "Bicikl ili sportska oprema",
    description: "Ovo je testna objava s Trampaj.hr platforme.",
    location: "Zagreb",
    imageUris: [],
  };

  const results: Record<string, string> = {};

  try {
    await postToFacebook(testListing);
    results["facebook"] = "ok";
  } catch (err) {
    logger.error({ err }, "FB test error");
    results["facebook"] = String(err);
  }

  try {
    await postToInstagram(testListing);
    results["instagram"] = "ok";
  } catch (err) {
    logger.error({ err }, "IG test error");
    results["instagram"] = String(err);
  }

  res.json({ ok: true, results });
});

// GET /api/social/status — provjeri jesu li tokeni postavljeni
router.get("/social/status", (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ ok: false });
    return;
  }

  res.json({
    facebook: {
      configured: !!(process.env["META_PAGE_ID"] && process.env["META_PAGE_TOKEN"]),
      pageId: process.env["META_PAGE_ID"] ? "✅ postavljen" : "❌ nedostaje META_PAGE_ID",
      token: process.env["META_PAGE_TOKEN"] ? "✅ postavljen" : "❌ nedostaje META_PAGE_TOKEN",
    },
    instagram: {
      configured: !!(process.env["META_IG_USER_ID"] && process.env["META_PAGE_TOKEN"]),
      userId: process.env["META_IG_USER_ID"] ? "✅ postavljen" : "❌ nedostaje META_IG_USER_ID",
    },
  });
});

export default router;
