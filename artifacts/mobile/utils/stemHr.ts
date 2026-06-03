/**
 * Jednostavni HR stemmer — skida najčešće nastavke da bi se
 * "stolicu", "stolice", "stolici" sve svele na "stolic"
 * i mogle uspoređivati s "stolica".
 */

const SUFFIXES = [
  // 5+ slova
  "icama", "ovima", "evima", "astim", "astih",
  // 4 slova
  "osti", "skim", "ačka", "ačke", "ičke", "njem", "anje", "enje",
  // 3 slova
  "ima", "ama", "ova", "eve", "evi", "aci", "nje", "sti",
  // 2 slova
  "om", "em", "og", "ih", "im", "oj", "ju", "om", "uh",
  // 1 slovo
  "a", "e", "i", "u", "o",
];

const MIN_STEM = 3; // ne skraćuj ispod 3 slova

export function stemHr(word: string): string {
  const w = word.toLowerCase();
  for (const suf of SUFFIXES) {
    if (w.endsWith(suf) && w.length - suf.length >= MIN_STEM) {
      return w.slice(0, w.length - suf.length);
    }
  }
  return w;
}

// Česte hrvatske prijedložne/vezničke riječice koje ne nose semantiku
const HR_STOPWORDS = new Set([
  "za", "i", "u", "na", "s", "sa", "od", "do", "iz", "po", "da", "li",
  "je", "su", "se", "si", "mi", "ti", "to", "te", "ni", "ne", "uz",
  "bez", "pri", "ili", "a", "pa", "al", "jer", "ali", "ako", "kad", "sto",
  "nesto", "sve", "sva", "sam", "ima", "ova", "taj", "ta", "mu", "ga",
  "me", "bi", "ce", "cu", "bi", "ih", "im", "vi",
]);

/** Normalizacija + tokenizacija + stemming jednog stringa */
export function stemTokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // ukloni dijakritike (č→c, š→s...)
    .split(/[\s,+\-\/\\.()\[\]]+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length >= 2 && !HR_STOPWORDS.has(w))
    .map(stemHr);
}

/**
 * Provjeri preklapa li upit (slobodni tekst) s listom polja.
 * Značajni tokeni upita (≥3 znaka, bez stopwordsova) moraju naći parnjaka.
 * Dovoljno je da VEĆINA (≥51%) značajnih tokena ima poklapanje.
 */
export function queryMatchesFields(query: string, fields: string[]): boolean {
  const qTokens = stemTokens(query).filter((t) => t.length >= 3);
  if (!qTokens.length) return false;

  const fTokens = fields.flatMap(stemTokens);
  if (!fTokens.length) return false;

  // ft mora počinjati s qt (query je prefiks fielda) — jednosmjerno,
  // da "stol" (table) ne matchira query "stolica" (chair)
  const matchCount = qTokens.filter((qt) =>
    fTokens.some((ft) => ft.startsWith(qt))
  ).length;

  // Zahtijevaj da barem 60% content-tokena ima poklapanje (min 1)
  return matchCount >= Math.max(1, Math.ceil(qTokens.length * 0.6));
}
