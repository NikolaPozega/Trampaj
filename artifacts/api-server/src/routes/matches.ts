import { Router } from "express";
import OpenAI from "openai";
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
import { eq, and, ne, desc, getTableColumns } from "drizzle-orm";
import { db, listingsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../middlewares/auth";
import type { AuthRequest } from "../middlewares/auth";

const router = Router();

interface SlimListing {
  id: string;
  title: string;
  description: string;
  wantedFor: string;
  category: string;
  imageUrl: string | null;
}

function parseSlim(row: Record<string, unknown>): SlimListing {
  const uris = (() => { try { return JSON.parse(row["imageUris"] as string) as string[]; } catch { return []; } })();
  const gcsUrl = uris.find((u) => u.startsWith("https://storage.googleapis.com/")) ?? null;
  return {
    id: row["id"] as string,
    title: row["title"] as string,
    description: ((row["description"] as string) ?? "").slice(0, 150),
    wantedFor: row["wantedFor"] as string,
    category: row["category"] as string,
    imageUrl: gcsUrl,
  };
}

// POST /api/listings/semantic-matches
// Returns AI-ranked trade match suggestions for the authenticated user.
router.post("/listings/semantic-matches", requireAuth, async (req: AuthRequest, res) => {
  if (!process.env["OPENAI_API_KEY"]) {
    res.json({ matches: [] });
    return;
  }

  const userId = req.userId!;

  try {
    const cols = getTableColumns(listingsTable);
    const fields = { ...cols, userName: usersTable.username };

    // 1. User's active listings
    const myRows = await db
      .select(fields)
      .from(listingsTable)
      .leftJoin(usersTable, eq(listingsTable.userId, usersTable.id))
      .where(and(
        eq(listingsTable.userId, userId),
        eq(listingsTable.status, "active"),
        eq(listingsTable.moderationStatus, "active"),
      ))
      .limit(5);

    if (!myRows.length) { res.json({ matches: [] }); return; }

    // 2. Other users' active listings (newest 60)
    const theirRows = await db
      .select(fields)
      .from(listingsTable)
      .leftJoin(usersTable, eq(listingsTable.userId, usersTable.id))
      .where(and(
        ne(listingsTable.userId, userId),
        eq(listingsTable.status, "active"),
        eq(listingsTable.moderationStatus, "active"),
      ))
      .orderBy(desc(listingsTable.createdAt))
      .limit(60);

    if (!theirRows.length) { res.json({ matches: [] }); return; }

    const myListings = myRows.map((r) => parseSlim(r as unknown as Record<string, unknown>));
    const theirListings = theirRows.map((r) => parseSlim(r as unknown as Record<string, unknown>));

    // 3. Build pairs (cap at 120 total)
    interface Pair { pair: number; myId: string; theirId: string; my: SlimListing; their: SlimListing }
    const pairs: Pair[] = [];
    outer: for (const mine of myListings) {
      for (const theirs of theirListings) {
        if (pairs.length >= 120) break outer;
        pairs.push({ pair: pairs.length, myId: mine.id, theirId: theirs.id, my: mine, their: theirs });
      }
    }

    const openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });

    // ── Phase 1: text-based semantic scoring ─────────────────────────────────
    const textPairs = pairs.map((p) => ({
      pair: p.pair,
      a: { naslov: p.my.title, opis: p.my.description, trazi: p.my.wantedFor, kat: p.my.category },
      b: { naslov: p.their.title, opis: p.their.description, trazi: p.their.wantedFor, kat: p.their.category },
    }));

    const textCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 2000,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `Ti si asistent za trampu predmeta na Trampaj.hr (hrvatska platforma za trampu bez novca).

KRITIČNA PRAVILA razumijevanja fraza:
- "torbica za Samsung" = torbica/futrola namijenjena Samsung telefonu (NE sam Samsung telefon!)
- "punjač za laptop" = punjač za laptop (NE laptop!)
- "maska za iPhone" = zaštitna maska za iPhone (NE iPhone!)
- Prijedlog "za" označava kompatibilnost ili namjenu — predmet iza "za" je uređaj/marka, ne željeni predmet
- Uvijek analiziraj cijelu frazu da shvatiš što osoba traži

PROCJENA:
Za svaki par oglasa ocijeni:
- aWantsB: želi li osoba A (polje "trazi") ono što B nudi (polje "naslov"+"opis")? (true/false)
- bWantsA: želi li osoba B ono što A nudi? (true/false)  
- score: 0–10 (10=savršeno obostrano, 5=jedno poklapanje, 0=nema smisla)

Primjeri:
- A trazi "torbicu za Samsung", B nudi "Samsung Galaxy S23+" → aWantsB=false (A trazi torbicu, ne telefon!), score=0
- A trazi "torbicu za Samsung", B nudi "Silikonska torbica za Samsung S23" → aWantsB=true, score=8
- A trazi "parfem", B nudi "Boss parfem 100ml" → aWantsB=true

Vrati SAMO JSON array (bez ikakvog teksta oko njega):
[{"pair":0,"aWantsB":true,"bWantsA":false,"score":5},...]`,
        },
        {
          role: "user",
          content: JSON.stringify(textPairs),
        },
      ],
    });

    const raw1 = textCompletion.choices[0]?.message?.content ?? "[]";
    const j1 = raw1.match(/\[[\s\S]*\]/);
    type AiResult = { pair: number; aWantsB: boolean; bWantsA: boolean; score: number };
    const textResults: AiResult[] = j1 ? JSON.parse(j1[0]) as AiResult[] : [];

    // ── Phase 2: vision re-scoring for top candidates with images ─────────────
    const topCandidates = textResults
      .filter((r) => r.score >= 5 && (r.aWantsB || r.bWantsA))
      .slice(0, 8);

    const imagePairs = topCandidates.filter((r) => {
      const p = pairs[r.pair];
      return p?.my.imageUrl && p?.their.imageUrl;
    });

    let visionResults: AiResult[] = [];
    if (imagePairs.length > 0) {
      const visionContent: ChatCompletionContentPart[] = [
        {
          type: "text",
          text: `Analiziraj slike sljedećih parova trampe i poboljšaj procjenu. Za svaki par vidiš dvije slike:
1. slika onoga što osoba A NUDI
2. slika onoga što osoba B NUDI

Procijeni vizualno poklapaju li se s onim što svaka osoba TRAŽI:
${imagePairs.map((r) => {
  const p = pairs[r.pair];
  return `Par ${r.pair}: A="${p?.my.title}" trazi="${p?.my.wantedFor}" | B="${p?.their.title}" trazi="${p?.their.wantedFor}"`;
}).join("\n")}

Vrati JSON: [{"pair":N,"aWantsB":true/false,"bWantsA":true/false,"score":0-10},...]`,
        },
      ];

      for (const r of imagePairs) {
        const p = pairs[r.pair];
        if (!p) continue;
        visionContent.push({ type: "text", text: `-- Par ${r.pair}: slika A (${p.my.title}):` });
        visionContent.push({ type: "image_url", image_url: { url: p.my.imageUrl!, detail: "low" } });
        visionContent.push({ type: "text", text: `-- Par ${r.pair}: slika B (${p.their.title}):` });
        visionContent.push({ type: "image_url", image_url: { url: p.their.imageUrl!, detail: "low" } });
      }

      try {
        const visionCompletion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 400,
          temperature: 0,
          messages: [
            { role: "system", content: "Ti si asistent za trampu predmeta. Analiziraj slike i procijeni poklapanje ponude i potražnje. Vrati SAMO JSON array." },
            { role: "user", content: visionContent },
          ],
        });
        const raw2 = visionCompletion.choices[0]?.message?.content ?? "[]";
        const j2 = raw2.match(/\[[\s\S]*\]/);
        if (j2) visionResults = JSON.parse(j2[0]) as AiResult[];
      } catch {
        // Vision call failed — fall back to text-only results
      }
    }

    // ── Merge results: vision scores override text scores for image pairs ──────
    const scoreMap = new Map<number, AiResult>();
    for (const r of textResults) scoreMap.set(r.pair, r);
    for (const r of visionResults) scoreMap.set(r.pair, r); // override with vision

    const finalResults = Array.from(scoreMap.values());

    const matches = finalResults
      .filter((r) => r.score >= 4 && (r.aWantsB || r.bWantsA))
      .map((r) => {
        const p = pairs[r.pair];
        if (!p) return null;
        return {
          myListingId: p.myId,
          theirListingId: p.theirId,
          matchType: (r.aWantsB && r.bWantsA ? "both" : r.aWantsB ? "i_want" : "they_want") as "both" | "i_want" | "they_want",
          score: r.score,
        };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    req.log.info({ userId, pairs: pairs.length, matches: matches.length }, "semantic-matches done");
    res.json({ matches });
  } catch (err) {
    req.log.error({ err }, "semantic-matches error");
    res.status(500).json({ error: "Matching nije uspio" });
  }
});

export default router;
