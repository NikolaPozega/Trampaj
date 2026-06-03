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
  location: string;
  updatedAt: number; // ms timestamp — koristi se za svježinu (bump resetira ovo)
  imageUrl: string | null;
  flexibility: string | null;   // "tocno" | "otvoren"
  cashFallback: boolean | null; // prihvaća gotovinu
  topup: string | null;         // "primam" | "dajem" | "oboje" | "ne"
  deadline: string | null;      // "hitno" | "ovaj-mjesec" | "bez-roka"
  condition: string | null;     // "Novo" | "Kao novo" | "Jako dobro" | "Dobro" | "Prihvatljivo"
  price: number | null;         // procijenjena vrijednost u eurima
  nudimTags: string[];          // AI-generirani tagovi za ono što nude (kompaktni ključni pojmovi)
  trazimTags: string[];         // AI-generirani tagovi za ono što traže
}

function parseSlim(row: Record<string, unknown>): SlimListing {
  const uris = (() => { try { return JSON.parse(row["imageUris"] as string) as string[]; } catch { return []; } })();
  const gcsUrl = uris.find((u) => u.startsWith("https://storage.googleapis.com/")) ?? null;
  return {
    id: row["id"] as string,
    title: row["title"] as string,
    description: ((row["description"] as string) ?? "").slice(0, 120),
    wantedFor: row["wantedFor"] as string,
    category: row["category"] as string,
    location: (row["location"] as string) ?? "",
    updatedAt: row["updatedAt"] instanceof Date ? row["updatedAt"].getTime() : Date.now(),
    imageUrl: gcsUrl,
    flexibility: (row["flexibility"] as string | null) ?? null,
    cashFallback: (row["cashFallback"] as boolean | null) ?? null,
    topup: (row["topup"] as string | null) ?? null,
    deadline: (row["deadline"] as string | null) ?? null,
    condition: (row["condition"] as string | null) ?? null,
    price: typeof row["price"] === "number" ? row["price"] : null,
    nudimTags: (() => { try { return JSON.parse(row["nudimTags"] as string) as string[]; } catch { return []; } })(),
    trazimTags: (() => { try { return JSON.parse(row["trazimTags"] as string) as string[]; } catch { return []; } })(),
  };
}

// Izvuci grad iz adrese (npr. "Ilica 14, Zagreb" → "zagreb")
function extractCity(location: string): string {
  const parts = location.split(",").map((s) => s.trim());
  return (parts[parts.length - 1] ?? "").toLowerCase();
}

// Je li listing fleksibilan (prihvaća i nepotpune trampe)?
function isFlexible(l: SlimListing): boolean {
  return l.flexibility === "otvoren" || l.cashFallback === true || l.topup === "primam" || l.topup === "oboje";
}

// POST /api/listings/semantic-matches
router.post("/listings/semantic-matches", requireAuth, async (req: AuthRequest, res) => {
  if (!process.env["OPENAI_API_KEY"]) {
    res.json({ matches: [] });
    return;
  }

  const userId = req.userId!;
  const { dismissedIds = [] } = req.body as { dismissedIds?: string[] };
  const dismissedSet = new Set<string>(dismissedIds);

  try {
    const cols = getTableColumns(listingsTable);
    const fields = { ...cols, userName: usersTable.username };

    // 1. Korisnikovi aktivni oglasi
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

    // 2. Tuđi aktivni oglasi (najnoviji 60, bez odbijenih)
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
      .limit(80);

    if (!theirRows.length) { res.json({ matches: [] }); return; }

    const myListings = myRows.map((r) => parseSlim(r as unknown as Record<string, unknown>));
    // Točka 2: filtriraj već odbijene oglase
    const theirListings = theirRows
      .map((r) => parseSlim(r as unknown as Record<string, unknown>))
      .filter((l) => !dismissedSet.has(l.id));

    if (!theirListings.length) { res.json({ matches: [] }); return; }

    // 3. Gradi parove (max 120)
    interface Pair { pair: number; myId: string; theirId: string; my: SlimListing; their: SlimListing }
    const pairs: Pair[] = [];
    outer: for (const mine of myListings) {
      for (const theirs of theirListings) {
        if (pairs.length >= 120) break outer;
        pairs.push({ pair: pairs.length, myId: mine.id, theirId: theirs.id, my: mine, their: theirs });
      }
    }

    const openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });

    // ── Faza 1: semantičko ocjenjivanje (tekst) ──────────────────────────────
    const textPairs = pairs.map((p) => ({
      pair: p.pair,
      a: {
        naslov: p.my.title,
        tagovi_nudim: p.my.nudimTags,    // AI-komprimirani ključni pojmovi za predmet
        tagovi_trazim: p.my.trazimTags,  // AI-komprimirani ključni pojmovi za željeno
        trazi: p.my.wantedFor,
        kat: p.my.category,
        stanje: p.my.condition ?? null,
        cijena_eur: p.my.price ?? null,
        flex: p.my.flexibility ?? "tocno",
        gotovina: p.my.cashFallback ?? false,
        doplatak: p.my.topup ?? "ne",
        hitno: p.my.deadline === "hitno",
      },
      b: {
        naslov: p.their.title,
        tagovi_nudim: p.their.nudimTags,
        tagovi_trazim: p.their.trazimTags,
        trazi: p.their.wantedFor,
        kat: p.their.category,
        stanje: p.their.condition ?? null,
        cijena_eur: p.their.price ?? null,
        flex: p.their.flexibility ?? "tocno",
        gotovina: p.their.cashFallback ?? false,
        doplatak: p.their.topup ?? "ne",
        hitno: p.their.deadline === "hitno",
      },
    }));

    const textCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 2000,
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `Ti si asistent za trampu predmeta na Trampaj.hr (hrvatska platforma za trampu).

PODACI KOJE DOBIVAŠ:
- naslov: naziv predmeta
- tagovi_nudim: AI-generirani ključni pojmovi za predmet koji se nudi (najvažniji signal!)
- tagovi_trazim: AI-generirani ključni pojmovi za ono što vlasnik želi dobiti (najvažniji signal!)
- trazi: slobodan opis što vlasnik želi u zamjenu
- stanje: fizičko stanje predmeta ("Novo", "Kao novo", "Jako dobro", "Dobro", "Prihvatljivo")
- cijena_eur: procijenjena vrijednost predmeta u eurima (null = nepoznato)

KRITIČNA PRAVILA za razumijevanje fraza:
- "torbica za Samsung" = torbica/futrola ZA Samsung telefon (NE sam Samsung telefon!)
- "punjač za laptop" = punjač ZA laptop (NE laptop!)
- Prijedlog "za" uvijek označava kompatibilnost — predmet iza "za" je uređaj, ne željeni predmet
- tagovi_trazim su precizniji od polja "trazi" — koristi ih kao primarni signal

VRIJEDNOST (VAŽNO):
- Ako su cijena_eur poznate obje strane: veliki nesrazmjer (>8x) bez doplatka = loš match, smanji score
- Primjer: A nudi €400 telefon, B nudi €20 parfem, doplatak="ne" na obje strane → score max 3
- Ako je doplatak="primam"/"oboje" ili gotovina=true → nesrazmjer vrijednosti je ok

STANJE PREDMETA:
- Ako B-ovi tagovi_trazim sugeriraju "novo" ili "neoštećeno" a A-ov predmet je "Prihvatljivo" → smanji score
- "Kao novo" i "Jako dobro" su generalno prihvatljivi za većinu korisnika

FLEKSIBILNOST (VAŽNO):
- flex="otvoren" → vlasnik prihvaća različite ponude (nije samo ono u "trazi")
- gotovina=true → prihvaća gotovinu kao dio trampe
- doplatak="primam"/"oboje" → prima novac uz predmet
- Za fleksibilne listinge score može biti viši i kod djelomičnog poklapanja

HITNOST:
- hitno=true → vlasnik želi trampu što prije, spremniji je na kompromis

Za svaki par procijeni:
- aWantsB: želi li A (prema tagovi_trazim i trazi) ono što B nudi (tagovi_nudim)?
- bWantsA: želi li B (prema tagovi_trazim i trazi) ono što A nudi (tagovi_nudim)?
- score: 0–10 (10=savršeno obostrano, 6=jedno poklapanje ili fleksibilna trampa, 0=nema smisla)

Primjeri:
- A.tagovi_nudim=["samsungs23"] A.tagovi_trazim=["torbica","futrola"], B.tagovi_nudim=["futrola","samsung"] → aWantsB=true
- A.tagovi_nudim=["boss","parfem"] cijena=20, B.tagovi_nudim=["samsung","s23"] cijena=400, doplatak="ne" obje → score=1
- A.tagovi_nudim=["gitara"] cijena=150, B.tagovi_trazim=["gitara","instrument"] → bWantsA=true, score=8

Vrati SAMO JSON array (bez ikakvog teksta):
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

    // ── Faza 2: vizualna provjera slika za top kandidate ─────────────────────
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
          text: `Analiziraj slike sljedećih parova trampe i poboljšaj procjenu.
Za svaki par vidiš: sliku A (što osoba A NUDI) i sliku B (što osoba B NUDI).
Procijeni vizualno je li trampa smislena uzimajući u obzir što svaka osoba TRAŽI:
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
        visionContent.push({ type: "text", text: `Par ${r.pair} — slika A (${p.my.title}):` });
        visionContent.push({ type: "image_url", image_url: { url: p.my.imageUrl!, detail: "low" } });
        visionContent.push({ type: "text", text: `Par ${r.pair} — slika B (${p.their.title}):` });
        visionContent.push({ type: "image_url", image_url: { url: p.their.imageUrl!, detail: "low" } });
      }

      try {
        const visionCompletion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          max_tokens: 400,
          temperature: 0,
          messages: [
            { role: "system", content: "Ti si asistent za trampu predmeta. Analiziraj slike i procijeni poklapanje. Vrati SAMO JSON array." },
            { role: "user", content: visionContent },
          ],
        });
        const raw2 = visionCompletion.choices[0]?.message?.content ?? "[]";
        const j2 = raw2.match(/\[[\s\S]*\]/);
        if (j2) visionResults = JSON.parse(j2[0]) as AiResult[];
      } catch {
        // Vision call failed — nastavi s text-only rezultatima
      }
    }

    // ── Spoji rezultate (vision overrides text za image parove) ───────────────
    const scoreMap = new Map<number, AiResult>();
    for (const r of textResults) scoreMap.set(r.pair, r);
    for (const r of visionResults) scoreMap.set(r.pair, r);

    const finalResults = Array.from(scoreMap.values());

    // ── Post-processing: lokacija + svježina boostovi ─────────────────────────
    const boosted = finalResults.map((r) => {
      const p = pairs[r.pair];
      if (!p) return r;

      let { score } = r;

      // Točka 1: lokacija — isti grad → +1.5 boda
      const myCity = extractCity(p.my.location);
      const theirCity = extractCity(p.their.location);
      if (myCity && theirCity && myCity === theirCity) {
        score = Math.min(10, score + 1.5);
      }

      // Točka 3: svježina — koristi updatedAt (bump resetira timer)
      const daysSince = (Date.now() - p.their.updatedAt) / (1000 * 60 * 60 * 24);
      if (daysSince < 7) score = Math.min(10, score + 1.0);
      else if (daysSince < 30) score = Math.min(10, score + 0.5);

      // Hitnost: hitno oglasi imaju blagi bonus
      if (p.their.deadline === "hitno") score = Math.min(10, score + 0.5);

      // Vrijednost: usklađene cijene dobivaju bonus, velik nesrazmjer penalizira
      const pa = p.my.price;
      const pb = p.their.price;
      if (pa && pb) {
        const ratio = Math.max(pa, pb) / Math.min(pa, pb);
        const aFlex = isFlexible(p.my);
        const bFlex = isFlexible(p.their);
        if (ratio <= 2) {
          // Slične vrijednosti → blagi bonus
          score = Math.min(10, score + 0.5);
        } else if (ratio > 8 && !aFlex && !bFlex) {
          // Dramatičan nesrazmjer bez fleksibilnosti → penalizacija
          score = Math.max(0, score - 2.5);
        }
      }

      return { ...r, score };
    });

    // ── Filtriraj i sortiraj ───────────────────────────────────────────────────
    // Točka 4 (fleksibilnost): fleksibilni listinge prolaze s nižim pragom (3 umjesto 4)
    const matches = boosted
      .filter((r) => {
        if (!r.aWantsB && !r.bWantsA) return false;
        const p = pairs[r.pair];
        if (!p) return false;
        const flexible = isFlexible(p.their) || isFlexible(p.my);
        const threshold = flexible ? 3 : 4;
        return r.score >= threshold;
      })
      .map((r) => {
        const p = pairs[r.pair];
        if (!p) return null;
        return {
          myListingId: p.myId,
          theirListingId: p.theirId,
          matchType: (r.aWantsB && r.bWantsA ? "both" : r.aWantsB ? "i_want" : "they_want") as "both" | "i_want" | "they_want",
          score: Math.round(r.score * 10) / 10,
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
