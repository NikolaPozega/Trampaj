---
name: Simulacija 500 korisnika — rezultati
description: Rezultati load testa i dijagnostike (performanse, match, AI) za 500 test korisnika i 1480 oglasa. Generirano 2026-07-23.
---

## Što je testirano
- 500 test korisnika (`test_user_001`..`test_user_500`), 1480 oglasa direktno u DB
- 1040 HTTP zahtjeva mjereno (serijski + load)
- Match logika: 5 korisnika × semantic-matches endpoint
- AI: analiza prompta i koda (bez slika)
- Puni report: `scripts/simulation-report.md`

## Performanse endpointova (serijski)

| Endpoint | Avg | p95 | Max |
|---|---|---|---|
| GET /listings (feed) | 580ms | 1205ms | 2100ms |
| GET /listings?search | 46ms | 134ms | 280ms |
| POST /auth/login | 295ms | 561ms | 820ms |
| GET /listings/:id | 31ms | 89ms | 190ms |
| POST /saved/:id | 23ms | 37ms | 80ms |
| GET /saved | 20ms | 32ms | 60ms |
| GET /auth/me | 31ms | 66ms | 120ms |
| GET /reviews/:username | 21ms | 33ms | 55ms |
| POST /semantic-matches | ~17000ms | — | — |

**Nula grešaka** na svim endpointima.

## Load test (concurrent)

| Scenarij | Concurrent | p95 | Greške |
|---|---|---|---|
| Feed | 500 | **8136ms** | 0 |
| Search | 100 | 301ms | 0 |
| Oglas detalji | 50 | 59ms | 0 |
| Favoriti | 50 | 59ms | 0 |

## Match logika — 0 matcheva za test korisnike
Test oglasi nemaju slike → AI vision faza ne može vizualno potvrditi → score ispod thresholda.
To je normalno za seed bez slika. Match engine logički radi ispravno.

## Ključni nalazi

**🔴 Popravi odmah:**
1. Feed caching (Redis, TTL 30-60s) — 8.1s pri 500 concurrent neprihvatljivo
2. Besmisleni naslovi ("asdf") prolaze — dodaj min 20 znakova server-side
3. Tag fallback kad nudimTags=[] — tokeniziraj naslov
4. Match caching (TTL 1h) — 17s po pozivu, nema cachinga

**🟡 Može čekati:**
- "Banane u zdjeli" prompt fix
- DB indeksi na location/category/moderation_status
- Rate limiting (max 5 objava/min)
- Pool s 10 → 20-30 konekcija

**🟢 Ne dirati (radi dobro):**
- AI typo korekcija, dual-phase matching, location/freshness boost
- cashFallback/flexibility threshold, korisnikove izmjene > AI
- Search p95=134ms, favoriti/profil/recenzije sve ispod 100ms

## Zaključak
Sustav podnosi 500 korisnika bez pada, ali feed latencija je bottleneck.
Za frendove: spreman uz feed caching. Bez cachinga: 8s bijeli ekran pri spike prometu.

## Brisanje test podataka
```sql
DELETE FROM users WHERE username LIKE 'test_user_%';
-- kaskadira na listings, saved_listings, conversations, messages, reviews
```
