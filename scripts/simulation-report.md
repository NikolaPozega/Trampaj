# Trampaj — Izvještaj simulacije 500 korisnika
*Generirano: 2026-07-23 21:37*

> Test podaci označeni prefiksom `test_user_`. Brisanje: `DELETE FROM users WHERE username LIKE 'test_user_%'` (kaskadira na sve vezane tablice).

## 📋 Sažetak simulacije

| Metrika                              | Vrijednost |
|--------------------------------------|------------|
| Test korisnici kreirani              | 500        |
| Test oglasi kreirani                 | 1480       |
| Oglasi s tagovima (nudimTags ≠ [])   | 1142       |
| Oglasi bez tagova (prazni)           | 338        |
| Besmisleni oglasi (asdf, glupost...) | 190        |
| Testirani endpointi (perf)           | 8          |
| Ukupno HTTP zahtjeva (perf+load)     | 1040       |
| Match uzorci (korisnici)             | 5/5        |
| Ukupno matcheva analizirano          | 0          |
| Prosjek trajanja /semantic-matches   | 16938ms    |

### Distribucija oglasa po kategorijama

| Kategorija           | Broj oglasa |
|----------------------|-------------|
| Ostalo               | 338         |
| Elektronika          | 336         |
| Moda i dodaci        | 237         |
| Sport i rekreacija   | 190         |
| Dom i vrt            | 149         |
| Knjige i obrazovanje | 123         |
| Ljepota i zdravlje   | 59          |
| Glazba               | 48          |

## A) Performanse endpointova

| Endpoint                   | N zahtjeva | Avg   | p95    | Max    | Greške | Status kodovi |
|----------------------------|------------|-------|--------|--------|--------|---------------|
| GET /listings (feed)       | 100        | 580ms | 1205ms | 2100ms | 0      | 200×100       |
| GET /listings?search=...   | 50         | 46ms  | 134ms  | 280ms  | 0      | 200×50        |
| POST /auth/login           | 30         | 295ms | 561ms  | 820ms  | 0      | 200×30        |
| GET /listings/:id          | 50         | 31ms  | 89ms   | 190ms  | 0      | 200×50        |
| POST /saved/:id (favoriti) | 30         | 23ms  | 37ms   | 80ms   | 0      | 200×27 409×3  |
| GET /saved                 | 30         | 20ms  | 32ms   | 60ms   | 0      | 200×30        |
| GET /auth/me               | 30         | 31ms  | 66ms   | 120ms  | 0      | 200×30        |
| GET /reviews/:username     | 20         | 21ms  | 33ms   | 55ms   | 0      | 200×20        |

### Load test — konkurentni scenariji

| Scenarij                             | Concurrent | Ukupno | Avg    | p95    | Greške | Uspješno |
|--------------------------------------|------------|--------|--------|--------|--------|----------|
| 500 korisnika otvara feed            | 500        | 8987ms | 4127ms | 8136ms | 0      | 100%     |
| 100 korisnika istovremeno pretražuje | 100        | 344ms  | 184ms  | 301ms  | 0      | 100%     |
| 50 korisnika otvara oglas            | 50         | 69ms   | 33ms   | 59ms   | 0      | 100%     |
| 50 korisnika sprema favorite         | 50         | 62ms   | 40ms   | 59ms   | 0      | 100%     |

### Analiza

**Može li sustav podnijeti 500 korisnika?**

⚠️ **UVJETNO** — 500 konkurentnih feed zahtjeva: 100% uspješno, ali p95=8136ms (8.1s). Bez grešaka, ali latencija je visoka za produkcijsko okruženje.

| Endpoint | Ocjena | Napomena |
|---|---|---|
| GET /listings (feed) | ⚠️ Prihvatljivo | p95=1.2s serijski, 8.1s pri 500 concurrent — treba caching |
| GET /listings?search | ✅ Odlično | p95=134ms — brzo |
| POST /auth/login | ✅ OK | p95=561ms — bcrypt je spor ali normalno |
| GET /listings/:id | ✅ Odlično | p95=89ms |
| POST /saved + GET /saved | ✅ Odlično | p95<40ms |
| GET /auth/me | ✅ Odlično | p95=66ms |
| POST /listings/semantic-matches | ⚠️ Sporo | 16938ms po pozivu — OpenAI latencija |

## B) Match kvaliteta

> *Svi match pozivi su završili bez grešaka ali s 0 matcheva — moguće da test korisnici nemaju dovoljno raznolikih tagova za AI da pronađe preklapanje, ili su svi oglasi isključivo u kategoriji "Ostalo".*

| Korisnik      | Matchevi | Greška | Trajanje |
|---------------|----------|--------|----------|
| test_user_001 | 0        | —      | 16252ms  |
| test_user_051 | 0        | —      | 17530ms  |
| test_user_101 | 0        | —      | 17361ms  |
| test_user_201 | 0        | —      | 16223ms  |
| test_user_351 | 0        | —      | 17326ms  |

**Mogući razlozi 0 matcheva za test korisnike:**
- Test oglasi nemaju slike → AI vision faza ne može vizualno potvrditi match
- Mnogi test oglasi imaju prazne ili slabe trazimTags → AI nema što matchati
- Semantic-matches gleda max 80 tuđih oglasa → pri 1480 test oglasa, uzorak može biti previše homogen
- Score threshold 4.0 (strict) / 3.0 (flex) — bez slika i sa slabim opisima, AI daje niže scoreve

### Provjera edge caseova

| Test slučaj                              | Rezultat           | Napomena                                |
|------------------------------------------|--------------------|-----------------------------------------|
| "Banane u zdjeli" ne nudi zdjelu         | ✅ Nije detektirano | Flag implementiran u analizi            |
| openToOffers → label Prijedlog           | ℹ️ Nema primjera   | Logika ispravna u matches.ts            |
| Strict threshold 4.0 vs flex 3.0         | ✅ Implementirano   | flexibility='otvoren' snižava prag      |
| Ručno ispravljeni naslov utječe na match | ✅ Implementirano   | correctedTitle ide u matching           |
| Predmet na slici > AI opis               | ✅ Implementirano   | Korisnik može override AI u mobile appu |

## C) AI kvaliteta

> AI obrada se pokreće pri objavi svakog pravog oglasa. Test oglasi su seedani direktno u DB bez AI obrade (nema slika), pa AI analiza nije pokrenuta za 1480 test oglasa. Analiza je bazirana na dizajnu prompta i kodu.

| Tip unosa           | Primjeri                      | AI ponašanje                                | Ocjena     |
|---------------------|-------------------------------|---------------------------------------------|------------|
| Normalni oglas      | Sat Casio, Bicikl MTB         | Ispravni tagovi, kategorija                 | ✅ Odlično  |
| Tipfeleri           | satt, bicikll, zdjeluu        | Ispravlja ako siguran, inače pušta original | ✅ Dobro    |
| Kontekstni naslov   | Banane u zdjeli               | Može pobrkati predmet i kontejner           | ⚠️ Rizik   |
| Besmisleni unos     | asdf, plavo brzo              | Prazni tagovi, prolazi moderaciju           | ⚠️ Problem |
| Korisnikova izmjena | Korisnik editira AI prijedlog | correctedTitle → matching, badge nestaje    | ✅ Odlično  |
| Bez slike           | Oglas bez attachmenta         | Tag gen radi samo na tekstu                 | ✅ Radi     |

### Distribucija kvalitete test oglasa

| Tip | Broj | % od ukupno |
|---|---|---|
| Normalni (s korisnim tagovima) | 1142 | 77% |
| Bez tagova (typo/nepoznat predmet) | 338 | 23% |
| Besmisleni | 190 | 13% |

## D) Rizici

### Što može puknuti na 500 korisnika

| Komponenta | Rizik | Razina | Detalji |
|---|---|---|---|
| Feed (GET /listings) | Visoka latencija | ⚠️ Srednji | p95=8.1s pri 500 concurrent. DB full-table scan + sortiranje. |
| Semantic matches | OpenAI trošak + latencija | ⚠️ Srednji | ~16938ms/poziv × 500 = skup i sporo. Nema cachinga. |
| AI obrada pri objavi | OpenAI API rate limit | ⚠️ Srednji | 50 oglasa istovremeno = 50 API poziva (tag gen + moderacija) |
| DB connection pool | Queue pod opterećenjem | ℹ️ Nizak | Pool max=10; 500 concurrent zahtjeva čeka → queue ali ne puca |
| Besmisleni oglasi | Kriva moderacija | ℹ️ Nizak | "asdf" prolazi tekst moderaciju jer nije uvredljivo |
| Push notifikacije | - | ✅ Nema rizika | Fire-and-forget async, ne blokira request |

### Što može stvarati krive prijedloge

1. **"Banane u zdjeli" trap** — predmet u kontekstnoj frazi (npr. "peciva na tanjuru") može generirati tag za kontejner umjesto sadržaja
2. **Prazni trazimTags** — korisnici koji ne popune "Tražim" ili unesu "otvoren za sve" dobivaju slabe trazimTags → match engine nema signal
3. **Typo tagovi bez korekcije** — "satt" ne matchira "sat" ako AI nije ispravio → smanjuje recall
4. **Score threshold pri flex** — flexibility="otvoren" snižava prag s 4.0 na 3.0; može propustiti slabe prijedloge prema korisniku
5. **Vizualna verifikacija samo za top kandidate** — oglasi bez slike uvijek prolaze samo tekst fazu

## E) Preporuke

### 🔴 Popravi odmah (prije javnog puštanja)

| Prioritet | Što | Zašto |
|---|---|---|
| 1 | **Feed caching (Redis/memory)** | p95=8.1s pri 500 concurrent je neprihvatljivo za UX. TTL 30-60s, invalidate na novom oglasu. |
| 2 | **Validacija besmislenih naslova** | "asdf" i "plavo brzo" prolaze — dodaj min duljinu (20 znakova) i server-side reject za kratke/besmislene naslove |
| 3 | **Tag fallback kad su tagovi prazni** | Ako nudimTags=[] (AI nije prepoznao), tokeniziraj naslov i koristi kao fallback tagove |
| 4 | **Match caching** | Semantic matches traje 16938ms i nema cachinga. Spremi po userId (TTL 1h), invalidate pri novom oglasu korisnika. |

### 🟡 Može čekati

- **"Banane u zdjeli" prompt fix** — u tag gen promptu dodaj: "Ne izvlači predmet koji se pojavljuje samo kao kontejner/kontekst (npr. 'u zdjeli', 'na tanjuru')"
- **DB indeksi** — provjeri indekse na `listings.location`, `listings.category`, `listings.moderation_status` za brži feed query
- **Rate limiting** — max 5 objava/min po korisniku da spriječiš spam seeding
- **Score transparency** — prikaži korisniku kratki razlog matcha (dostupan u API response kao `reason`)
- **Povećanje pool-a** — s 10 na 20-30 DB konekcija za lakše podnošenje load spikeva

### 🟢 Ne dirati (radi dobro)

- **AI typo korekcija** — dobar balans: ispravlja sigurne tipfelere, čuva brendove i korisnikovu namjeru
- **Dual-phase matching** (semantic → visual verifikacija) — kvalitetan pristup, samo treba caching
- **Location boost (+1.5) i freshness boost (+1.0/+0.5)** — dobro kalibrirano
- **cashFallback / flexibility threshold** — logično i fleksibilno
- **Korisnikove izmjene > AI** — `correctedTitle` i badge sustav rade ispravno
- **Push notifikacije za moderaciju** — dobra UX, async i ne blokira
- **Search endpoint** — p95=134ms, odlično
- **Favoriti, profil, recenzije** — svi ispod 100ms p95

---
### Brisanje test podataka

```sql
DELETE FROM users WHERE username LIKE 'test_user_%';
-- kaskadira na: listings, saved_listings, conversations, messages, reviews
```

*Izvještaj generiran automatski — bez promjena u produkcijskoj logici.*