/**
 * Test script: Testira generateListingTags i detectCategoryLocally
 * sa ~60 kombinacija ulaznih podataka.
 *
 * Pokreni: pnpm --filter @workspace/scripts run test-listings
 */

const API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? process.env.OPENAI_API_KEY ?? "";

// ─── LOCAL CATEGORY DETECTION (kopija iz openai.ts) ──────────────────────────

const LOCAL_KEYWORDS: Record<string, string[]> = {
  Namještaj: ["stolic", "stolac", " stol", "ormar", "krevet", "polica", "sofa", "fotelja", "ladica", "lampa", "komoda", "garnitura", "divan", "klupa", "regal"],
  Elektronika: ["laptop", "iphone", "samsung", "telefon", "mobitel", "tablet", "slušalic", "kamera", "konzola", "punjač", "zvučnik", "monitor", "computer", "računalo", "printer", "ekran", "playstation", "xbox", "airpod"],
  Odjeća: ["jakna", "majica", "hlač", "cipele", "torba", "kaput", "haljina", "tenisic", "džemper", "šešir", "prsluk", "suknja", "košulja", "odijelo", "mantil", "traperice", "traperic", "bluza", "vjetrovka"],
  Knjige: ["knjig", "roman", "udžbenik", "strip", "rječnik", "kuharica", "atlas", "priručnik"],
  Sport: ["bicikl", "lopta", " ski ", "skijaš", "skijanje", "roler", "fitnes", "tenis", "šator", "ruksak", "daska", "jedrilica", "reketa", "kajakaš", "ronilac", "snowboard"],
  Nakit: ["narukvic", "ogrlica", "prsten", "naušnic", "broš", "lančić", "medaljon", "nakit", "dijamant"],
  Igračke: ["lego", "puzzle", "igračk", "kocke", "figuric", "plišan", "barbika"],
};

function detectCategoryLocally(text: string): string {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(LOCAL_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return "";
}

// ─── AI TAGS (kopija logike iz openai.ts) ────────────────────────────────────

async function generateListingTags(
  title: string,
  description: string,
  wantedFor: string
): Promise<{ nudimTags: string[]; trazimTags: string[]; correctedTitle: string; correctedDescription: string }> {
  if (!API_KEY) throw new Error("Nema API ključa");

  const prompt = `Korisnik je tipkao brzo na mobitelu i napravio tipfelere. Tvoj zadatak:

1. ISPRAVI TIPFELERE u naslovu i opisu — zamijeni pogrešno upisana slova ispravnom hrvatskom riječju (npr. "Dtolica"→"Stolica", "Volica"→"Stolica", "Modevna"→"Moderna"). Ako je riječ besmislena, zaključi što je korisnik htio napisati.

2. GENERIRAJ nudimTags — ključne riječi što osoba NUDI. Max 12 riječi na hrvatskom.

3. GENERIRAJ trazimTags — ključne riječi što osoba TRAŽI. Max 8.

Naslov: "${title}"
Opis: "${description}"
Što traži: "${wantedFor}"

Odgovori SAMO ovim JSON-om:
{"correctedTitle":"...","correctedDescription":"...","nudimTags":["..."],"trazimTags":["..."]}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 300,
      messages: [
        { role: "system", content: "Ti si asistent za oglas trampe. Ispravljaš tipfelere i generiraš tagove. Vrati SAMO validan JSON." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const data = await response.json() as { choices: Array<{ message: { content: string } }> };
  const raw = data.choices[0]?.message?.content ?? "{}";
  const match = raw.match(/\{[\s\S]*\}/);
  const parsed = match ? JSON.parse(match[0]) : {};
  return {
    nudimTags: Array.isArray(parsed.nudimTags) ? parsed.nudimTags.slice(0, 12) : [],
    trazimTags: Array.isArray(parsed.trazimTags) ? parsed.trazimTags.slice(0, 8) : [],
    correctedTitle: parsed.correctedTitle || title,
    correctedDescription: parsed.correctedDescription || description,
  };
}

// ─── TEST CASES ───────────────────────────────────────────────────────────────

// Format: [title, description, wantedFor, expectedCategory, hasTypo, description]
const LOCAL_TESTS: Array<[string, string]> = [
  // Namještaj
  ["Drvena stolica", "Namještaj"],
  ["Moderna fotelja", "Namještaj"],
  ["Kuhinjski stol", "Namještaj"],
  ["Ormar za odjeću", "Namještaj"],
  ["Komoda bijela", "Namještaj"],
  ["Krevet 160x200", "Namještaj"],
  ["Polica za knjige", "Namještaj"],
  ["Lampa za čitanje", "Namještaj"],
  // Tipfeleri Namještaj
  ["Dtolica drvena", "Namještaj"],
  ["Volica za kuhinju", "Namještaj"],
  ["Foteja koža", "Namještaj"],
  // Elektronika
  ["iPhone 13 Pro", "Elektronika"],
  ["Samsung laptop", "Elektronika"],
  ["Sony slušalice", "Elektronika"],
  ["PlayStation konzola", "Elektronika"],
  ["Bežični zvučnik", "Elektronika"],
  ["Monitor 27 inča", "Elektronika"],
  // Tipfeleri Elektronika
  ["Laptp HP", "Elektronika"],
  ["Sluasalice JBL", "Elektronika"],
  // Odjeća
  ["Zimska jakna XL", "Odjeća"],
  ["Nike tenisice 43", "Odjeća"],
  ["Ljetna haljina", "Odjeća"],
  ["Kožna torba", "Odjeća"],
  ["Bijela majica M", "Odjeća"],
  ["Traperice slim fit", "Odjeća"],
  // Tipfeleri Odjeća
  ["Jakna zimsk", "Odjeća"],
  ["Tenisice adidsa", "Odjeća"],
  // Knjige
  ["Roman Ana Karenjina", "Knjige"],
  ["Udžbenik matematike", "Knjige"],
  ["Strip Superman", "Knjige"],
  ["Kuharica mediteranska", "Knjige"],
  // Sport
  ["Mtb bicikl 29", "Sport"],
  ["Fudbalska lopta", "Sport"],
  ["Skijaška oprema", "Sport"],
  ["Teniski reket", "Sport"],
  ["Planinski ruksak", "Sport"],
  // Tipfeleri Sport
  ["Bciikl gradski", "Sport"],
  // Nakit
  ["Zlatna ogrlica", "Nakit"],
  ["Srebrna narukvica", "Nakit"],
  ["Dijamantni prsten", "Nakit"],
  // Igračke
  ["Lego kocke 500kom", "Igračke"],
  ["Puzzle 1000 dijelova", "Igračke"],
  ["Plišana igračka", "Igračke"],
  // Ostalo (ne detektira lokalno)
  ["Akustična gitara", ""],
  ["Alat za vrt", ""],
  ["Uljana slika", ""],
];

const AI_TESTS = [
  { title: "Dtolica", description: "Tapecirana, dobro stanje", wantedFor: "Tv", note: "tipfeler: Dtolica" },
  { title: "Laptp HP 15", description: "8GB RAM, SSD 256", wantedFor: "Mobitel", note: "tipfeler: Laptp" },
  { title: "Zimsk jakna L", description: "Topla, malo nošena", wantedFor: "Tenisice Nike", note: "tipfeler: zimsk" },
  { title: "Bciikl gradski", description: "Shimano mjenjač, 7 brzina", wantedFor: "Bicikl MTB ili bicikla", note: "tipfeler: Bciikl" },
  { title: "Sony sluslaice", description: "Bežične, noise cancelling", wantedFor: "iPhone punjač", note: "tipfeler: sluslaice" },
  { title: "Lego Technic 42083", description: "Komplet, sve kockice, nije sklapano", wantedFor: "Puzzle, igračke", note: "bez tipfelera" },
  { title: "iPhone 12 128gb", description: "Kao novo, bez ogrebotina, s kutijom", wantedFor: "Samsung ili drugi android", note: "bez tipfelera, tech" },
  { title: "Gitara električna", description: "Fender Stratocaster, crvena, s pojačalom", wantedFor: "Akustična gitara ili efekti", note: "bez tipfelera, Ostalo" },
  { title: "Haljina svečana", description: "Crvena, veličina 38, nošena jednom", wantedFor: "Torba ili cipele za svečanost", note: "bez tipfelera, Odjeća" },
  { title: "Stlo kuhinjski", description: "Drven, 4 stolice, bijela boja", wantedFor: "Komoda ili polica", note: "tipfeler: Stlo" },
  { title: "Enciklopedija za djecuuu", description: "10 knjiga, ilustrirana, dobro stanje", wantedFor: "Igračke ili puzzle", note: "tipfeler: djecuuu" },
  { title: "Planinski šator 2 osobe", description: "Malo korišten, vodootporan, s vrećama", wantedFor: "Sleeping bag ili ruksak", note: "Sport, bez tipfelera" },
];

// ─── RUN TESTS ────────────────────────────────────────────────────────────────

function pad(str: string, len: number) {
  return str.slice(0, len).padEnd(len);
}

async function runLocalTests() {
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  LOKALNA DETEKCIJA KATEGORIJE (instant, bez AI)");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log(pad("Naslov", 30) + pad("Očekivano", 14) + pad("Dobiveno", 14) + "Status");
  console.log("─".repeat(70));

  let pass = 0, fail = 0;
  for (const [title, expected] of LOCAL_TESTS) {
    const got = detectCategoryLocally(title);
    const ok = got === expected;
    if (ok) pass++; else fail++;
    const status = ok ? "✅" : `❌ (dobio: "${got || "ništa"}")`;
    console.log(pad(title, 30) + pad(expected || "ništa", 14) + pad(got || "ništa", 14) + status);
  }

  console.log("─".repeat(70));
  console.log(`  Rezultat: ${pass}/${LOCAL_TESTS.length} prošlo | ${fail} nije`);
}

async function runAITests() {
  if (!API_KEY) {
    console.log("\n⚠️  Nema OPENAI_API_KEY — preskačem AI testove");
    return;
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  AI ISPRAVAK TIPFELERA + TAGOVI (12 poziva)");
  console.log("═══════════════════════════════════════════════════════════════\n");

  for (const tc of AI_TESTS) {
    process.stdout.write(`  [${tc.note}]\n`);
    process.stdout.write(`  Ulaz:    "${tc.title}" | "${tc.description}"\n`);
    try {
      const result = await generateListingTags(tc.title, tc.description, tc.wantedFor);
      const titleFixed = result.correctedTitle !== tc.title;
      process.stdout.write(`  Naslov:  "${tc.title}" → "${result.correctedTitle}" ${titleFixed ? "✅ ispravljen" : "⚠️  nije ispravljen"}\n`);
      process.stdout.write(`  nudimTags: [${result.nudimTags.join(", ")}]\n`);
      process.stdout.write(`  trazimTags: [${result.trazimTags.join(", ")}]\n`);
    } catch (e) {
      process.stdout.write(`  ❌ Greška: ${e}\n`);
    }
    process.stdout.write("\n");
    await new Promise(r => setTimeout(r, 300)); // kratka pauza između poziva
  }
}

async function main() {
  console.log("\n🧪 TRAMPAJ — Test liste oglasa\n");
  await runLocalTests();
  await runAITests();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  Gotovo!");
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main().catch(console.error);
