import { Router } from "express";
import { randomUUID } from "crypto";
import { requireAuth } from "../middlewares/auth";
import type { AuthRequest } from "../middlewares/auth";
import { objectStorageClient } from "../lib/objectStorage";

const router = Router();

// POST /api/uploads/image
// Accepts base64 image from mobile, stores in GCS, returns public URL
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
      public: true,
    });

    const publicUrl = `https://storage.googleapis.com/${bucketId}/${filename}`;
    res.json({ url: publicUrl });
  } catch (err) {
    req.log.error({ err }, "image upload error");
    res.status(500).json({ error: "Upload slike nije uspio" });
  }
});

export default router;
