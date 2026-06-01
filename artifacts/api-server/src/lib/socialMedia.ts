import { logger } from "./logger";

const META_PAGE_ID = process.env["META_PAGE_ID"];
const META_USER_TOKEN = process.env["META_PAGE_TOKEN"];
const META_IG_USER_ID = process.env["META_IG_USER_ID"];
const APP_URL = process.env["APP_URL"] ?? "https://trampaj.hr";

// Extract Page Access Token from User token (cached per process)
let cachedPageToken: string | null = null;
async function getPageToken(): Promise<string | null> {
  if (cachedPageToken) return cachedPageToken;
  if (!META_PAGE_ID || !META_USER_TOKEN) return null;
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${META_PAGE_ID}?fields=access_token&access_token=${META_USER_TOKEN}`
    );
    const data = await res.json() as { access_token?: string };
    if (data.access_token) {
      cachedPageToken = data.access_token;
      return cachedPageToken;
    }
  } catch (err) {
    logger.error({ err }, "Greška pri dohvatu Page tokena");
  }
  return null;
}

export interface ListingForPost {
  id: string;
  title: string;
  wantedFor: string;
  description: string;
  location: string;
  imageUris: string[];
}

function buildCaption(listing: ListingForPost): string {
  const lines: string[] = [];
  lines.push(`🔄 ${listing.title}`);
  if (listing.wantedFor) lines.push(`🤝 Tražim u zamjenu: ${listing.wantedFor}`);
  if (listing.location) lines.push(`📍 ${listing.location}`);
  lines.push("");
  lines.push("Jedna trampa, dvije sretne strane!");
  lines.push(`👉 ${APP_URL}`);
  lines.push("");
  lines.push("#trampaj #trampa #razmjena #hrvatska #besplatno #secondhand");
  return lines.join("\n");
}

// ─── Facebook stranica ────────────────────────────────────────────────────────
export async function postToFacebook(listing: ListingForPost): Promise<void> {
  if (!META_PAGE_ID || !META_USER_TOKEN) {
    logger.warn("META_PAGE_ID ili META_PAGE_TOKEN nije postavljen, preskačem FB objavu");
    return;
  }

  const pageToken = await getPageToken();
  if (!pageToken) {
    logger.warn("Nije moguće dohvatiti Page token, preskačem FB objavu");
    return;
  }

  const caption = buildCaption(listing);
  const imageUrl = listing.imageUris[0];

  try {
    if (imageUrl) {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${META_PAGE_ID}/photos`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: imageUrl, caption, access_token: pageToken }),
        }
      );
      const data = await res.json() as { id?: string; error?: { message: string } };
      if (data.error) throw new Error(data.error.message);
      logger.info({ postId: data.id }, "Facebook objava objavljena");
    } else {
      const res = await fetch(
        `https://graph.facebook.com/v19.0/${META_PAGE_ID}/feed`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: caption, access_token: pageToken }),
        }
      );
      const data = await res.json() as { id?: string; error?: { message: string } };
      if (data.error) throw new Error(data.error.message);
      logger.info({ postId: data.id }, "Facebook objava objavljena (tekst)");
    }
  } catch (err) {
    logger.error({ err }, "Greška pri Facebook objavi");
  }
}

// ─── Instagram (2-koračni process) ────────────────────────────────────────────
export async function postToInstagram(listing: ListingForPost): Promise<void> {
  if (!META_IG_USER_ID || !META_USER_TOKEN) {
    logger.warn("META_IG_USER_ID ili META_PAGE_TOKEN nije postavljen, preskačem IG objavu");
    return;
  }

  const imageUrl = listing.imageUris[0];
  if (!imageUrl) {
    logger.warn({ listingId: listing.id }, "Nema slike za Instagram objavu");
    return;
  }

  const pageToken = await getPageToken();
  if (!pageToken) {
    logger.warn("Nije moguće dohvatiti Page token, preskačem IG objavu");
    return;
  }

  const caption = buildCaption(listing);

  try {
    // Korak 1: Kreiraj media container
    const containerRes = await fetch(
      `https://graph.facebook.com/v19.0/${META_IG_USER_ID}/media`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image_url: imageUrl,
          caption,
          access_token: pageToken,
        }),
      }
    );
    const container = await containerRes.json() as { id?: string; error?: { message: string } };
    if (container.error) throw new Error(container.error.message);
    if (!container.id) throw new Error("Nema container ID-a");

    // Korak 2: Objavi media container
    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${META_IG_USER_ID}/media_publish`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          creation_id: container.id,
          access_token: pageToken,
        }),
      }
    );
    const published = await publishRes.json() as { id?: string; error?: { message: string } };
    if (published.error) throw new Error(published.error.message);
    logger.info({ postId: published.id }, "Instagram objava objavljena");
  } catch (err) {
    logger.error({ err }, "Greška pri Instagram objavi");
  }
}

// ─── Objavi na sve mreže ───────────────────────────────────────────────────────
export async function postToSocialMedia(listing: ListingForPost): Promise<void> {
  await Promise.allSettled([
    postToFacebook(listing),
    postToInstagram(listing),
  ]);
}
