import { Router } from "express";
import { randomUUID } from "crypto";
import { requireAuth } from "../middlewares/auth";
import type { AuthRequest } from "../middlewares/auth";
import { objectStorageClient } from "../lib/objectStorage";

const router = Router();

// POST /api/uploads/image
// Accepts base64 image from mobile, stores in GCS, returns public proxy URL
router.post("/uploads/image", requireAuth, async (req: AuthRequest, res) => {
  const { base64Image, mimeType } = req.body as { base64Image?: string; mimeType?: string };

  if (!base64Image) {
    res.status(400).json({ error: "base64Image je obavezan" });
    return;
  }

  const bucketId = process.env["DEFAULT_OBJECT_STORAGE_BUCKET_ID"];
  if (!bucketId) {
    res.status(503).json({ error: "Storage nije konfiguriran" });
    return;
  }

  try {
    const ext = (mimeType ?? "image/jpeg").includes("png") ? "png" : "jpg";
    const filename = `listings/${randomUUID()}.${ext}`;
    const contentType = mimeType ?? "image/jpeg";

    const buffer = Buffer.from(base64Image, "base64");
    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(filename);

    await file.save(buffer, {
      metadata: { contentType },
      resumable: false,
    });

    const proto = req.secure || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
    const host = (process.env["REPLIT_DOMAINS"] ?? "").split(",")[0].trim() || req.get("host") || "localhost";
    const publicUrl = `${proto}://${host}/api/uploads/serve/${filename}`;
    res.json({ url: publicUrl });
  } catch (err) {
    req.log.error({ err }, "image upload error");
    res.status(500).json({ error: "Upload slike nije uspio" });
  }
});

// GET /api/uploads/serve/*
// Streams stored image from GCS — no auth required (listing images are public)
router.get("/uploads/serve/*path", async (req, res) => {
  const bucketId = process.env["DEFAULT_OBJECT_STORAGE_BUCKET_ID"];
  if (!bucketId) {
    res.status(503).send("Storage nije konfiguriran");
    return;
  }

  const filePath = Array.isArray(req.params["path"])
    ? req.params["path"].join("/")
    : String(req.params["path"] ?? "");

  if (!filePath) {
    res.status(404).send("Not found");
    return;
  }

  try {
    const bucket = objectStorageClient.bucket(bucketId);
    const file = bucket.file(filePath);

    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).send("Not found");
      return;
    }

    const [metadata] = await file.getMetadata();
    const contentType = (metadata.contentType as string) || "image/jpeg";

    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");

    file.createReadStream().pipe(res);
  } catch (err) {
    req.log.error({ err }, "serve image error");
    res.status(500).send("Greška pri učitavanju slike");
  }
});

export default router;
