const getApiKey = () => process.env.EXPO_PUBLIC_OPENAI_API_KEY ?? "";

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
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${base64Image}`, detail: "low" },
            },
            {
              type: "text",
              text: `Analiziraj sliku predmeta i vrati SAMO JSON (bez ikakvog teksta oko njega):
{"category":"<Elektronika|Odjeća|Knjige|Sport|Nakit|Namještaj|Igračke|Ostalo>","title":"<naziv predmeta na hrvatskom max 5 riječi>","description":"<opis na hrvatskom max 12 riječi>"}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) throw new Error("AI analiza nije uspjela");

  const data = await response.json();
  const text: string = data.choices[0]?.message?.content ?? "{}";
  const match = text.match(/\{[\s\S]*\}/);
  const parsed = match ? JSON.parse(match[0]) : {};

  return {
    category: parsed.category ?? "Ostalo",
    title: parsed.title ?? "",
    description: parsed.description ?? "",
  };
}

export async function suggestTrades(
  newListing: { title: string; category: string; wantedFor: string },
  existingListings: Array<{ id: string; title: string; category: string; wantedFor: string }>
): Promise<string[]> {
  const candidates = existingListings.filter((l) => !l.id.startsWith("sample_") === false || true).slice(0, 30);
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
