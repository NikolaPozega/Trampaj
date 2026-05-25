import type { Listing } from "@/context/ListingsContext";
import { detectCategoryLocally } from "@/services/openai";

export interface TradeMatch {
  myListing: Listing;
  theirListing: Listing;
  score: number;
  matchType: "both" | "i_want" | "they_want";
}

function norm(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function keywordsOverlap(a: string, b: string): boolean {
  const aWords = norm(a).split(/\s+/).filter((w) => w.length > 3);
  const bNorm = norm(b);
  return aWords.some((w) => bNorm.includes(w));
}

// Provjeri preklapa li se slobodni tekst (wantedFor) s tagovima drugog oglasa
function textMatchesTags(text: string, tags: string[]): boolean {
  if (!tags.length) return false;
  const words = norm(text).split(/[\s,+]+/).filter((w) => w.length > 3);
  if (!words.length) return false;
  const tagNorms = tags.map(norm);
  return words.some((w) => tagNorms.some((t) => t.includes(w) || w.includes(t)));
}

// Preklapa li se jedan set tagova s drugim
function tagsOverlap(a: string[], b: string[]): boolean {
  if (!a.length || !b.length) return false;
  const aNorms = a.map(norm);
  const bNorms = b.map(norm);
  return aNorms.some((at) => bNorms.some((bt) => at.includes(bt) || bt.includes(at)));
}

export function findTradeMatches(
  myListings: Listing[],
  allListings: Listing[]
): TradeMatch[] {
  const myActive = myListings.filter((l) => l.status === "active");
  const theirActive = allListings.filter((l) => !l.isMine && l.status === "active");

  const matches: TradeMatch[] = [];
  const seen = new Set<string>();

  for (const mine of myActive) {
    const iWantCat = detectCategoryLocally(mine.wantedFor);
    const myCat = mine.category;

    for (const theirs of theirActive) {
      const key = `${mine.id}::${theirs.id}`;
      if (seen.has(key)) continue;

      const theyWantCat = detectCategoryLocally(theirs.wantedFor);

      // Ja tražim njih: kategorija, slobodan tekst, ili tagovi
      const iWantThem =
        (iWantCat && iWantCat === theirs.category) ||
        keywordsOverlap(mine.wantedFor, theirs.title) ||
        keywordsOverlap(mine.wantedFor, theirs.description) ||
        textMatchesTags(mine.wantedFor, theirs.nudimTags ?? []) ||
        tagsOverlap(mine.trazimTags ?? [], theirs.nudimTags ?? []);

      // Oni traže mene: kategorija, slobodan tekst, ili tagovi
      const theyWantMe =
        (theyWantCat && theyWantCat === myCat) ||
        keywordsOverlap(theirs.wantedFor, mine.title) ||
        keywordsOverlap(theirs.wantedFor, mine.description) ||
        textMatchesTags(theirs.wantedFor, mine.nudimTags ?? []) ||
        tagsOverlap(theirs.trazimTags ?? [], mine.nudimTags ?? []);

      if (!iWantThem && !theyWantMe) continue;

      const matchType: TradeMatch["matchType"] =
        iWantThem && theyWantMe ? "both" : iWantThem ? "i_want" : "they_want";

      // Osnova: both=3, jedno=1
      let score = matchType === "both" ? 3 : 1;

      // Bonus za tag poklapanje (preciznije od slobodnog teksta)
      const tagBonus =
        tagsOverlap(mine.trazimTags ?? [], theirs.nudimTags ?? []) ||
        tagsOverlap(theirs.trazimTags ?? [], mine.nudimTags ?? []);
      if (tagBonus) score += 1;

      // Bonus za blizinu cijene
      if (mine.price != null && theirs.price != null) {
        const diff = Math.abs(mine.price - theirs.price);
        const avg = (mine.price + theirs.price) / 2 || 1;
        const proximity = 1 - Math.min(diff / avg, 1);
        score += proximity * 2;
      }

      seen.add(key);
      matches.push({ myListing: mine, theirListing: theirs, score, matchType });
    }
  }

  // Sort best first, deduplicate their listings (keep highest score per theirListing.id)
  matches.sort((a, b) => b.score - a.score);

  const seenTheirs = new Set<string>();
  const deduped: TradeMatch[] = [];
  for (const m of matches) {
    if (!seenTheirs.has(m.theirListing.id)) {
      seenTheirs.add(m.theirListing.id);
      deduped.push(m);
    }
  }

  return deduped.slice(0, 20);
}
