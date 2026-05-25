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

/** Normalizacija + tokenizacija + stemming jednog stringa */
export function stemTokens(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")   // ukloni dijakritike (č→c, š→s...)
    .split(/[\s,+\-\/\\.()\[\]]+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ""))
    .filter((w) => w.length >= 2)
    .map(stemHr);
}

/**
 * Provjeri preklapa li upit (slobodni tekst) s listom polja.
 * Svaka token iz upita mora naći parnjaka u barem jednom polju.
 */
export function queryMatchesFields(query: string, fields: string[]): boolean {
  const qTokens = stemTokens(query);
  if (!qTokens.length) return true;

  const fTokens = fields.flatMap(stemTokens);
  if (!fTokens.length) return false;

  // ft mora počinjati s qt (query je prefiks fielda) — jednosmjerno,
  // da "stol" (table) ne matchira query "stolica" (chair)
  return qTokens.every((qt) =>
    fTokens.some((ft) => ft.startsWith(qt))
  );
}
