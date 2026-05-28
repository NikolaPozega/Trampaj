import OpenAI from "openai";

let _client: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (!process.env["OPENAI_API_KEY"]) return null;
  if (!_client) _client = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });
  return _client;
}

export interface ModerationResult {
  status: "active" | "rejected" | "pending";
  note: string | null;
}

/**
 * Moderira tekst oglasa (naslov + opis + što traži).
 * Vraća 'active' ako je uredu, 'rejected' ako je problematično.
 */
export async function moderateListingText(
  title: string,
  description: string,
  wantedFor: string,
): Promise<ModerationResult> {
  const client = getClient();
  if (!client) return { status: "active", note: null };

  try {
    const text = `Naslov: ${title}\nOpis: ${description}\nŽelim u zamjenu: ${wantedFor}`;
    const result = await client.moderations.create({ input: text });
    const flagged = result.results[0]?.flagged ?? false;

    if (flagged) {
      const cats = result.results[0]?.categories ?? {};
      const flaggedCats = Object.entries(cats)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(", ");
      return { status: "rejected", note: `Automatski zastavljen: ${flaggedCats}` };
    }
    return { status: "active", note: null };
  } catch {
    return { status: "active", note: null };
  }
}

/**
 * Moderira slike oglasa pomoću OpenAI Vision.
 * Provjerava jednu po jednu (max 3 slike).
 */
export async function moderateListingImages(
  imageUris: string[],
): Promise<ModerationResult> {
  const client = getClient();
  if (!client || imageUris.length === 0) return { status: "active", note: null };

  const toCheck = imageUris.slice(0, 3);

  for (const uri of toCheck) {
    if (!uri.startsWith("http") && !uri.startsWith("data:")) continue;
    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_tokens: 60,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: 'Pregledaj ovu sliku za oglas zamjene. Odgovori SAMO jednom riječju: "OK" ako je prihvatljiva (predmet za prodaju/zamjenu), ili "FLAG" ako sadrži: golotinju, nasilje, oružje, drogu, krivotvorene brendove ili drugu zabranjenu sadržaj.',
              },
              { type: "image_url", image_url: { url: uri, detail: "low" } },
            ],
          },
        ],
      });

      const answer = response.choices[0]?.message?.content?.trim().toUpperCase() ?? "OK";
      if (answer.includes("FLAG")) {
        return { status: "rejected", note: "Slika sadrži neprimjeren sadržaj." };
      }
    } catch {
      // Vision greška — ne blokiraj oglas
    }
  }

  return { status: "active", note: null };
}

/**
 * Kompletna moderacija — tekst + slike.
 */
export async function moderateListing(
  title: string,
  description: string,
  wantedFor: string,
  imageUris: string[],
): Promise<ModerationResult> {
  const [textResult, imageResult] = await Promise.all([
    moderateListingText(title, description, wantedFor),
    moderateListingImages(imageUris),
  ]);

  if (textResult.status === "rejected") return textResult;
  if (imageResult.status === "rejected") return imageResult;
  return { status: "active", note: null };
}
