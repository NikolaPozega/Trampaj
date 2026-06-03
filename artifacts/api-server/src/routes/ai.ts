import { Router } from "express";
import OpenAI from "openai";
import { requireAuth } from "../middlewares/auth";
import type { AuthRequest } from "../middlewares/auth";

const router = Router();

const CATEGORY_EXAMPLES = `Elektronika: laptop, telefon, mobitel, tablet, slušalice, kamera, TV, konzola, punjač, zvučnik, monitor
Odjeća: jakna, majica, hlače, cipele, torba, kaput, haljina, tenisice, džemper, šešir
Knjige: roman, udžbenik, strip, rječnik, kuharica, atlas, priručnik, knjiga
Sport: bicikl, lopta, skijaška oprema, roleri, fitnes, tenis, šator, ruksak, daska, jedrilica
Nakit: narukvica, ogrlica, prsten, sat, naušnice, broš, lančić
Namještaj: stolica, stol, ormar, krevet, polica, sofa, fotelja, ladica, lampa, komoda, garnitura
Igračke: lego, puzzle, igra, kocke, automobil, lutka, plišani, figurica
Ostalo: alat, slika, biljka, kolekcionarski, instrument, gitara, klavir`;

// POST /api/ai/analyze-image
router.post("/ai/analyze-image", requireAuth, async (req: AuthRequest, res) => {
  const { base64Image } = req.body as { base64Image?: string };

  if (!base64Image) {
    res.status(400).json({ error: "base64Image je obavezan" });
    return;
  }

  if (!process.env["OPENAI_API_KEY"]) {
    res.status(503).json({ error: "AI nije dostupan" });
    return;
  }

  try {
    const openai = new OpenAI({ apiKey: process.env["OPENAI_API_KEY"] });

    const completion = await openai.chat.completions.create({
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
    });

    const text: string = completion.choices[0]?.message?.content ?? "{}";
    const match = text.match(/\{[\s\S]*?\}/);
    const parsed = (match ? JSON.parse(match[0]) : {}) as Record<string, string>;

    const validCategories = ["Elektronika", "Odjeća", "Knjige", "Sport", "Nakit", "Namještaj", "Igračke", "Ostalo"];
    const aiCategory = parsed["category"] ?? "";
    const matchedCategory = validCategories.find(
      (c) => c.toLowerCase() === aiCategory.toLowerCase()
    ) ?? "";

    res.json({
      category: matchedCategory,
      title: parsed["title"] ?? "",
      description: parsed["description"] ?? "",
    });
  } catch (err) {
    req.log.error({ err }, "ai analyze-image error");
    res.status(500).json({ error: "AI analiza nije uspjela" });
  }
});

export default router;
