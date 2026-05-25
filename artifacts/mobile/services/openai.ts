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
  Namještaj: ["stolic", "stolac", "stol", "ormar", "krevet", "polica", "sofa", "fotelja", "ladica", "lampa", "komoda", "garnitura", "divan", "klupa", "regal"],
  Elektronika: ["laptop", "telefon", "mobitel", "tablet", "slušalic", "kamera", "konzola", "punjač", "zvučnik", "monitor", "computer", "računalo", "printer", "ekran"],
  Odjeća: ["jakna", "majica", "hlač", "cipele", "torba", "kaput", "haljina", "tenisic", "džemper", "šešir", "prsluk", "suknja", "košulja", "odijelo", "mantil"],
  Knjige: ["knjig", "roman", "udžbenik", "strip", "rječnik", "kuharica", "atlas", "priručnik"],
  Sport: ["bicikl", "lopta", "ski", "roler", "fitnes", "tenis", "šator", "ruksak", "daska", "jedrilica", "reketa", "kajakaš"],
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
      max_tokens: 200,
      messages: [
        {
          role: "system",
          content: `Ti si asistent koji prepoznaje predmete sa slika.
Dostupne kategorije:
${CATEGORY_EXAMPLES}

VAŽNO: Uvijek odgovaraj SAMO JSON-om na hrvatskom jeziku, bez ikakvog teksta oko JSON-a.`,
        },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: "low" },
            },
            {
              type: "text",
              text: `Što je na slici? Odredi TOČNU kategoriju iz popisa, naziv i opis na HRVATSKOM.
Odgovori SAMO ovim JSON-om (bez teksta oko njega):
{"category":"<kategorija iz popisa>","title":"<naziv max 5 riječi>","description":"<opis max 10 riječi>"}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) throw new Error("AI analiza nije uspjela");

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
): Promise<{ nudimTags: string[]; trazimTags: string[] }> {
  const apiKey = getApiKey();
  if (!apiKey) {
    const normalize = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const tokenize = (s: string) =>
      normalize(s).split(/[\s,.!?;:()\-\/\\]+/).filter((w) => w.length >= 3);
    return {
      nudimTags: [...new Set([...tokenize(title), ...tokenize(description)])].slice(0, 12),
      trazimTags: [...new Set(tokenize(wantedFor))].slice(0, 10),
    };
  }

  const userPromptText = `Naslov: "${title}"
Opis: "${description}"
Što traži: "${wantedFor}"

Vrati SAMO ovaj JSON:
{"nudimTags":["tag1","tag2",...],"trazimTags":["tag1","tag2",...]}

nudimTags = ključne riječi koje opisuju što osoba NUDI — kombiniraj tekst I ono što vidiš na slici (boja, materijal, stil, marka, stanje...), max 20 riječi na hrvatskom
trazimTags = ključne riječi što osoba TRAŽI (iz polja "što traži"), max 10 riječi`;

  const userContent: unknown[] = base64Image
    ? [
        {
          type: "image_url",
          image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: "low" },
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
        max_tokens: 250,
        messages: [
          {
            role: "system",
            content: `Generiraj ključne riječi za oglas trampe na hrvatskom. ${base64Image ? "Analiziraj i sliku — dodaj vizualne detalje: boja, materijal, stil, marka, dimenzije, stanje." : ""} Vrati SAMO JSON bez ikakvog teksta oko njega.`,
          },
          {
            role: "user",
            content: userContent,
          },
        ],
      }),
    });

    if (!response.ok) throw new Error("tags failed");
    const data = await response.json();
    const text: string = data.choices[0]?.message?.content ?? "{}";
    const match = text.match(/\{[\s\S]*?\}/);
    const parsed = match ? JSON.parse(match[0]) : {};
    return {
      nudimTags: Array.isArray(parsed.nudimTags) ? parsed.nudimTags.slice(0, 20) : [],
      trazimTags: Array.isArray(parsed.trazimTags) ? parsed.trazimTags.slice(0, 10) : [],
    };
  } catch {
    const normalize = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const tokenize = (s: string) =>
      normalize(s).split(/[\s,.!?;:()\-\/\\]+/).filter((w) => w.length >= 3);
    return {
      nudimTags: [...new Set([...tokenize(title), ...tokenize(description)])].slice(0, 12),
      trazimTags: [...new Set(tokenize(wantedFor))].slice(0, 10),
    };
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
