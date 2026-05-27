const getApiKey = () => process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? "";

const CATEGORY_EXAMPLES = `Elektronika: laptop, telefon, mobitel, tablet, slušalice, kamera, TV, konzola, punjač, zvučnik, monitor
Odjeća: jakna, majica, hlače, cipele, torba, kaput, haljina, tenisice, džemper, šešir
Knjige: roman, udžbenik, strip, rječnik, kuharica, atlas, priručnik, knjiga
Sport: bicikl, lopta, skijaška oprema, roleri, fitnes, tenis, šator, ruksak, daska, jedrilica
Nakit: narukvica, ogrlica, prsten, sat, naušnice, broš, lančić
Namještaj: stolica, stol, ormar, krevet, polica, sofa, fotelja, ladica, lampa, komoda, garnitura
Igračke: lego, puzzle, igra, kocke, automobil, lutka, plišani, figurica
Ostalo: alat, slika, biljka, kolekcionarski, instrument, gitara, klavir`;

// Local keyword fallback — detects without AI call
const LOCAL_KEYWORDS: Record<string, string[]> = {
  Namještaj: ["stolic", "stolac", " stol", "ormar", "krevet", "polica", "sofa", "fotelja", "ladica", "lampa", "komoda", "garnitura", "divan", "klupa", "regal"],
  Elektronika: ["laptop", "iphone", "samsung", "telefon", "mobitel", "tablet", "slušalic", "kamera", "konzola", "punjač", "zvučnik", "monitor", "computer", "računalo", "printer", "ekran", "playstation", "xbox", "airpod"],
  Odjeća: ["jakna", "majica", "hlač", "cipele", "torba", "kaput", "haljina", "tenisic", "džemper", "šešir", "prsluk", "suknja", "košulja", "odijelo", "mantil", "traperice", "traperic", "bluza", "vjetrovka"],
  Knjige: ["knjig", "roman", "udžbenik", "strip", "rječnik", "kuharica", "atlas", "priručnik"],
  Sport: ["bicikl", "lopta", " ski ", "skijaš", "skijanje", "roler", "fitnes", "tenis", "šator", "ruksak", "daska", "jedrilica", "reketa", "kajakaš", "ronilac", "snowboard"],
  Nakit: ["narukvic", "ogrlica", "prsten", "naušnic", "broš", "lančić", "medaljon", "nakit", "dijamant"],
  Igračke: ["lego", "puzzle", "igračk", "kocke", "figuric", "plišan", "barbika"],
};

export function detectCategoryLocally(text: string): string {
  const lower = text.toLowerCase();
  for (const [category, keywords] of Object.entries(LOCAL_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return "";
}

export async function analyzeImageForCategory(base64Image: string): Promise<{
  category: string;
  title: string;
  description: string;
}> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 300,
      messages: [
        {
          role: "system",
          content: `Ti si asistent koji prepoznaje predmete sa slika za oglase trampe.
Dostupne kategorije:
${CATEGORY_EXAMPLES}

KRITIČNO PRAVILO JEZIKA: Svi tekstovi u odgovoru moraju biti ISKLJUČIVO na standardnom hrvatskom jeziku. Ni jedan znak na engleskom, srpskom, bosanskom ni drugom jeziku. Ako je predmet stranog porijekla (npr. iPhone, Nike), naziv brendа ostavi, ali opis napiši na hrvatskom. Primjer: "iPhone 13 Pro" je ok naziv, ali opis mora biti "Pametni telefon u odličnom stanju, bez ogrebotina."

VAŽNO: Odgovaraj SAMO validnim JSON-om, bez ikakvog teksta oko JSON-a.`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: "auto" },
            },
            {
              type: "text",
              text: `Što je na slici? Napiši oglasnički naziv i opis ISKLJUČIVO na hrvatskom jeziku. Strani brend u nazivu je u redu (npr. "Nike tenisice"), ali sav ostali tekst mora biti hrvatski.
Odgovori SAMO ovim JSON-om (bez teksta oko njega):
{"category":"<kategorija iz popisa>","title":"<konkretan naziv predmeta na hrvatskom, max 6 riječi>","description":"<1-2 rečenice na hrvatskom: materijal, boja, stanje, dimenzije ako su vidljive>"}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "(no body)");
    throw new Error(`AI analiza nije uspjela: HTTP ${response.status} — ${errBody.slice(0, 200)}`);
  }

  const data = await response.json();
  const text: string = data.choices[0]?.message?.content ?? "{}";
  const match = text.match(/\{[\s\S]*?\}/);
  const parsed = match ? JSON.parse(match[0]) : {};

  const validCategories = ["Elektronika", "Odjeća", "Knjige", "Sport", "Nakit", "Namještaj", "Igračke", "Ostalo"];
  const aiCategory = parsed.category ?? "";

  // Normalize: check if AI returned a valid category (case-insensitive)
  const matchedCategory =
    validCategories.find((c) => c.toLowerCase() === aiCategory.toLowerCase()) ??
    validCategories.find((c) => aiCategory.toLowerCase().includes(c.toLowerCase())) ??
    detectCategoryLocally(aiCategory) ??
    "Ostalo";

  return {
    category: matchedCategory,
    title: parsed.title ?? "",
    description: parsed.description ?? "",
  };
}

export async function detectCategoryFromTitle(title: string): Promise<string> {
  // First try local keyword match (instant, free)
  const local = detectCategoryLocally(title);
  if (local) return local;

  if (title.trim().length < 3) return "";

  // Fall back to AI
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 20,
      messages: [
        {
          role: "system",
          content: `Kategoriziraj predmet u jednu od ovih kategorija i vrati SAMO naziv kategorije:
Elektronika, Odjeća, Knjige, Sport, Nakit, Namještaj, Igračke, Ostalo`,
        },
        {
          role: "user",
          content: `Predmet: "${title}"`,
        },
      ],
    }),
  });

  if (!response.ok) return "";

  const data = await response.json();
  const raw: string = data.choices[0]?.message?.content?.trim() ?? "";
  const validCategories = ["Elektronika", "Odjeća", "Knjige", "Sport", "Nakit", "Namještaj", "Igračke", "Ostalo"];
  return validCategories.find((c) => raw.includes(c)) ?? "";
}

export async function generateListingTags(
  title: string,
  description: string,
  wantedFor: string,
  base64Image?: string
): Promise<{ nudimTags: string[]; trazimTags: string[]; correctedTitle: string; correctedDescription: string }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    const normalize = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const tokenize = (s: string) =>
      normalize(s).split(/[\s,.!?;:()\-\/\\]+/).filter((w) => w.length >= 3);
    return {
      nudimTags: [...new Set([...tokenize(title), ...tokenize(description)])].slice(0, 12),
      trazimTags: [...new Set(tokenize(wantedFor))].slice(0, 10),
      correctedTitle: title,
      correctedDescription: description,
    };
  }

  const userPromptText = `Korisnik je tipkao brzo na mobitelu i napravio tipfelere. Tvoj zadatak:

1. ISPRAVI TIPFELERE u naslovu i opisu — zamijeni pogrešno upisana slova ispravnom hrvatskom riječju (npr. "Dtolica"→"Stolica", "Volica"→"Stolica", "Modevna"→"Moderna", "apecirana"→"tapecirana"). Ako je riječ besmislena, zaključi što je korisnik htio napisati.

2. GENERIRAJ nudimTags — ključne riječi što osoba NUDI.${base64Image ? " OBAVEZNO analiziraj sliku i dodaj vizualne opise: boju (npr. 'smeđa', 'bijela'), materijal ('drvo', 'metal', 'plastika', 'tkanina'), stil ('moderna', 'skandinavska', 'industrijska'), stanje i sve vidljive detalje." : ""} Max 20 riječi na hrvatskom.

3. GENERIRAJ trazimTags — ključne riječi što osoba TRAŽI (iz polja "Što traži"). Max 10.

Naslov: "${title}"
Opis: "${description}"
Što traži: "${wantedFor}"

Odgovori SAMO ovim JSON-om (bez ikakvog teksta oko njega):
{"correctedTitle":"...","correctedDescription":"...","nudimTags":["..."],"trazimTags":["..."]}`;

  const userContent: unknown = base64Image
    ? [
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: "auto" },
        },
        { type: "text", text: userPromptText },
      ]
    : userPromptText;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 350,
        messages: [
          {
            role: "system",
            content: `Ti si asistent za oglase trampe na Trampaj.hr. Uvijek ispravljaš tipfelere s mobitela (besmislene riječi zamijeni logičnom hrvatskom riječju) i generiraš bogate ključne riječi. KRITIČNO PRAVILO: correctedTitle i correctedDescription moraju biti ISKLJUČIVO na standardnom hrvatskom jeziku — nikad engleski, srpski ni bosanski. Nazivi stranih brendova su dopušteni (npr. Nike, iPhone, IKEA), ali svi opisi i atributi moraju biti na hrvatskom. Vrati SAMO validan JSON, bez ikakvog teksta oko njega.`,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text().catch(() => "(no body)");
      throw new Error(`tags HTTP ${response.status} — ${errBody.slice(0, 200)}`);
    }
    const data = await response.json();
    const raw: string = data.choices[0]?.message?.content ?? "{}";
    console.log("[TAGS] GPT raw odgovor:", raw);
    const match = raw.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : {};
    return {
      nudimTags: Array.isArray(parsed.nudimTags) ? parsed.nudimTags.slice(0, 20) : [],
      trazimTags: Array.isArray(parsed.trazimTags) ? parsed.trazimTags.slice(0, 10) : [],
      correctedTitle: typeof parsed.correctedTitle === "string" && parsed.correctedTitle ? parsed.correctedTitle : title,
      correctedDescription: typeof parsed.correctedDescription === "string" && parsed.correctedDescription ? parsed.correctedDescription : description,
    };
  } catch (err) {
    console.log("[TAGS] Greška:", String(err));
    const normalize = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const tokenize = (s: string) =>
      normalize(s).split(/[\s,.!?;:()\-\/\\]+/).filter((w) => w.length >= 3);
    return {
      nudimTags: [...new Set([...tokenize(title), ...tokenize(description)])].slice(0, 12),
      trazimTags: [...new Set(tokenize(wantedFor))].slice(0, 10),
      correctedTitle: title,
      correctedDescription: description,
    };
  }
}

export async function moderateText(text: string): Promise<{ flagged: boolean; reason?: string }> {
  const apiKey = getApiKey();
  if (!apiKey || !text.trim()) return { flagged: false };

  try {
    const response = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ input: text, model: "omni-moderation-latest" }),
    });

    if (!response.ok) return { flagged: false };

    const data = await response.json();
    const result = data.results?.[0];
    if (!result?.flagged) return { flagged: false };

    const cats = result.categories as Record<string, boolean>;
    const reasons: string[] = [];
    if (cats["hate"] || cats["hate/threatening"]) reasons.push("govor mržnje");
    if (cats["sexual"] || cats["sexual/minors"]) reasons.push("seksualni sadržaj");
    if (cats["violence"] || cats["violence/graphic"]) reasons.push("nasilje");
    if (cats["harassment"] || cats["harassment/threatening"]) reasons.push("uznemiravanje");
    if (cats["self-harm"]) reasons.push("samoozljeđivanje");
    if (cats["illicit"] || cats["illicit/violent"]) reasons.push("nezakonit sadržaj");

    return { flagged: true, reason: reasons.join(", ") || "neprimjeren sadržaj" };
  } catch {
    return { flagged: false };
  }
}

export async function moderateImage(base64Image: string): Promise<{ flagged: boolean; reason?: string }> {
  const apiKey = getApiKey();
  if (!apiKey || !base64Image) return { flagged: false };

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        max_tokens: 30,
        messages: [
          {
            role: "system",
            content: "Ti si moderator sadržaja. Odgovori SAMO s JSON-om: {\"safe\":true} ili {\"safe\":false,\"reason\":\"opis na hrvatskom\"}. Sadržaj je neprimjeren ako sadrži: golotinju, seksualnost, nasilje, oružje, drogu, extremizam ili ilegalne predmete.",
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: "low" },
              },
              { type: "text", text: "Je li ova slika prikladna za oglas trampe?" },
            ],
          },
        ],
      }),
    });

    if (!response.ok) return { flagged: false };

    const data = await response.json();
    const raw: string = data.choices?.[0]?.message?.content ?? "{}";
    const match = raw.match(/\{[\s\S]*?\}/);
    if (!match) return { flagged: false };
    const parsed = JSON.parse(match[0]) as { safe?: boolean; reason?: string };
    if (parsed.safe === false) {
      return { flagged: true, reason: parsed.reason ?? "neprimjeren vizualni sadržaj" };
    }
    return { flagged: false };
  } catch {
    return { flagged: false };
  }
}

export async function suggestTrades(
  newListing: { title: string; category: string; wantedFor: string },
  existingListings: Array<{ id: string; title: string; category: string; wantedFor: string }>
): Promise<string[]> {
  const candidates = existingListings.slice(0, 30);
  if (candidates.length === 0) return [];

  const listingsText = candidates
    .map((l) => `ID:${l.id}|${l.title}(${l.category})|Želi:${l.wantedFor}`)
    .join("\n");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: `Novi oglas: "${newListing.title}" (${newListing.category}), korisnik želi: "${newListing.wantedFor}"

Postojeći oglasi:
${listingsText}

Koji ID-evi bi bili dobra zamjena? Vrati SAMO JSON array s max 3 ID-a: ["id1","id2"]. Samo JSON.`,
        },
      ],
    }),
  });

  if (!response.ok) return [];

  const data = await response.json();
  const text: string = data.choices[0]?.message?.content ?? "[]";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  const ids: string[] = JSON.parse(match[0]);
  return ids.slice(0, 3);
}
