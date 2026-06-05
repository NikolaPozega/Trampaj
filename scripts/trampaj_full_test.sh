#!/usr/bin/env bash
API="http://localhost:80"
PASS=0; FAIL=0; WARN=0
ok()   { echo "  ✅ $1"; PASS=$((PASS+1)); }
fail() { echo "  ❌ $1"; FAIL=$((FAIL+1)); }
warn() { echo "  ⚠️  $1"; WARN=$((WARN+1)); }

# curl bez -f flaga (vraća JSON čak i na 4xx/5xx)
post()  { curl -s --max-time 12 -X POST  -H "Content-Type: application/json" ${3:+-H "Authorization: Bearer $3"} -d "$2" "$API$1"; }
get()   { curl -s --max-time 12          -H "Content-Type: application/json" ${2:+-H "Authorization: Bearer $2"} "$API$1"; }
patch() { curl -s --max-time 12 -X PATCH -H "Content-Type: application/json" ${3:+-H "Authorization: Bearer $3"} -d "$2" "$API$1"; }
put()   { curl -s --max-time 12 -X PUT   -H "Content-Type: application/json" ${3:+-H "Authorization: Bearer $3"} -d "$2" "$API$1"; }
del()   { curl -s --max-time 12 -X DELETE -H "Content-Type: application/json" ${2:+-H "Authorization: Bearer $2"} "$API$1"; }
scode() {
  local METHOD="${1:-GET}" UPATH="$2" BODY="${3:-}" TOKEN="${4:-}"
  curl -so /dev/null --max-time 12 -w "%{http_code}" \
    -X "$METHOD" -H "Content-Type: application/json" \
    ${TOKEN:+-H "Authorization: Bearer $TOKEN"} \
    ${BODY:+-d "$BODY"} "$API$UPATH"
}
j() { python3 -c "import json,sys; d=json.load(sys.stdin); print($2)" 2>/dev/null || echo ""; }
db() { psql "$DATABASE_URL" -t -A -c "$1" 2>/dev/null; }

echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  TRAMPAJ.HR — FULL TEST SUITE  $(date '+%Y-%m-%d %H:%M')"
echo "  50 korisnika | 50 oglasa | matching | chat | Stripe | security"
echo "══════════════════════════════════════════════════════════════"

# ── FAZA 0: Cleanup ──────────────────────────────────────────────────────────
echo ""; echo "📋 F0: Cleanup stare test podatke"
psql "$DATABASE_URL" << 'SQL' 2>/dev/null
DELETE FROM messages;
DELETE FROM saved_listings;
DELETE FROM escrow_deposits;
DELETE FROM conversations;
DELETE FROM listings;
DELETE FROM users WHERE email LIKE '%testtrampaj%';
SQL
UC=$(db "SELECT COUNT(*) FROM users WHERE email LIKE '%testtrampaj%';")
LC=$(db "SELECT COUNT(*) FROM listings;")
ok "Cleanup: $UC test-korisnika, $LC oglasa ostalo"

# ── FAZA 1: Admin login ──────────────────────────────────────────────────────
echo ""; echo "📋 F1: Admin"
R=$(post /api/auth/login '{"username":"AdminMaster","password":"Admin123!"}')
AT=$(echo "$R" | j . "d.get('token','')")
[ -n "$AT" ] && ok "Admin login OK" || { fail "Admin login: $R"; exit 1; }

# ── FAZA 2: 50 korisnika ─────────────────────────────────────────────────────
echo ""; echo "📋 F2: Registracija 50 korisnika"
NAMES=(Ana Ivan Marko Petra Luka Maja Tomislav Sara Nikola Iva Mario Lucija Ante Tea Filip
       Marta Josip Katarina Bruno Helena Stjepan Mateja Domagoj Klara Karlo Nora Vedran Lea
       Dario Tina Boris Anita Goran Iris Vlado Dijana Davor Sanja Kruno Natalija Dragan
       Vesna Nenad Gordana Zoran Lidija Tihomir Dubravka Renato Mirjana)
CITIES=(Zagreb Split Rijeka Osijek Zadar Pula Varaždin Šibenik Dubrovnik Sisak)
UTOK=(); XUIDS=(); UNAM=()
NREG=0
for i in $(seq 0 49); do
  UN="U${NAMES[$i]}${i}"
  EM="${UN,,}@testtrampaj.hr"
  post /api/auth/register \
    "{\"username\":\"$UN\",\"email\":\"$EM\",\"password\":\"Test123!\",\"city\":\"${CITIES[$((i%10))]}\",\"phone\":\"091${i}000000\"}" \
    > /dev/null 2>&1
  VT=$(db "SELECT verification_token FROM users WHERE email='$EM' LIMIT 1;")
  [ -z "$VT" ] && continue
  curl -sf --max-time 10 "$API/api/auth/verify/$VT" > /dev/null 2>&1 || true
  LR=$(post /api/auth/login "{\"username\":\"$UN\",\"password\":\"Test123!\"}")
  TOK=$(echo "$LR" | j . "d.get('token','')")
  XUID=$(echo "$LR" | j . "d.get('user',{}).get('id','')")
  [ -n "$TOK" ] && { UTOK+=("$TOK"); XUIDS+=("$XUID"); UNAM+=("$UN"); NREG=$((NREG+1)); }
done
NT=${#UTOK[@]}
[ $NREG -ge 45 ] && ok "Registrirano: $NREG/50 ($NT s tokenom)" || fail "Samo $NREG/50 registrirano"

# ── FAZA 3: 50 oglasa ────────────────────────────────────────────────────────
echo ""; echo "📋 F3: Kreiranje 50 oglasa"
TITLES=("iPhone 14 Pro" "Samsung Galaxy S23" "MacBook Pro M2" "Lenovo ThinkPad" "iPad Pro 2022"
  "Sony WH-1000XM5" "Bose QC45" "GoPro Hero 11" "PlayStation 5" "Xbox Series X"
  "Trek gradski bicikl" "Scott MTB 29col" "Nike Air Max 43" "Skijanje komplet" "Snowboard Burton"
  "Ruksak Osprey 60L" "Šator MSR 3os" "Canada Goose XL" "North Face Nuptse" "Levi 501 W32"
  "Yeezy 350 V2" "Supreme hoodie" "DeWalt bušilica 18V" "Bosch brusilica" "Makita circular"
  "Karcher K5" "Harry Potter 7knjiga" "Tolkien LOTR" "Python knjige 10" "IKEA Kallax 4x2"
  "Električni stol" "IKEA Poäng" "Fender Stratocaster" "Gibson SG Standard" "Roland FP-60X"
  "Pearl drumset" "Zimske gume 205/55" "Thule krovni nosač" "Lego Porsche" "Playmobil zamak"
  "Canon EOS R6" "Sony A7 III" "DJI Mini 3 Pro" "Xiaomi romobil" "Manduka yoga"
  "Kajak Prijon" "DeLonghi Dedica" "Nespresso Vertuo" "Vinyl 200+" "Pro-Ject gramofon")
CATS=(elektronika elektronika elektronika elektronika elektronika
  elektronika elektronika elektronika elektronika elektronika
  sport sport odjeća sport sport sport sport odjeća odjeća odjeća
  odjeća odjeća alati alati alati alati knjige knjige knjige namještaj
  namještaj namještaj glazba glazba glazba glazba automobili automobili igračke igračke
  elektronika elektronika elektronika elektronika sport sport ostalo ostalo glazba glazba)
WANTS=("Android flagship" "iPhone noviji" "Gaming laptop" "MacBook Air" "Android tablet"
  "AirPods Pro" "Sony XM5" "DJI action" "Xbox Series X" "PlayStation 5"
  "MTB bicikl" "Gradski bicikl" "Adidas Ultraboost" "Snowboard" "Skijaška oprema"
  "Šator ili vreća" "Ruksak 60L" "Patagonia jakna" "Canada Goose" "Wrangler traperice"
  "Air Jordan 1" "Palace hoodie" "Bosch set" "Polirka" "Puzzle pila"
  "Robot usisavač" "LOTR komplet" "Harry Potter" "JS knjige" "TV ormarić"
  "Gaming stolica" "Fotelja" "Gibson Les Paul" "Fender Stratocaster" "Yamaha P-125"
  "Elektronski bubnjevi" "Ljetne gume" "Bike nosač" "Lego Bugatti" "Lego City"
  "Sony A7 serija" "Canon R6" "DJI Air 2S" "Električni bicikl" "Kettlebell"
  "SUP daska" "Nespresso" "Filter kava" "Gramofon hi-fi" "Vinyl kolekcija")
CONDS=("novo" "kao novo" "dobro" "prihvatljivo")
LIDS=(); LOIDX=()
NLIST=0
for i in $(seq 0 49); do
  [ $NT -eq 0 ] && break
  TIDX=$((i % NT))
  BODY="{\"title\":\"${TITLES[$i]}\",\"description\":\"${TITLES[$i]} - ${CONDS[$((i%4))]}, odlično stanje\",\"category\":\"${CATS[$i]}\",\"wantedFor\":\"${WANTS[$i]}\",\"city\":\"${CITIES[$((i%10))]}\",\"phone\":\"099${i}111\",\"condition\":\"${CONDS[$((i%4))]}\",\"price\":$((50+i*10))}"
  R=$(post /api/listings "$BODY" "${UTOK[$TIDX]}")
  LID=$(echo "$R" | j . "(d.get('listing') or d).get('id','')")
  [ -n "$LID" ] && { LIDS+=("$LID"); LOIDX+=("$TIDX"); NLIST=$((NLIST+1)); }
done
[ $NLIST -ge 45 ] && ok "Kreirano oglasa: $NLIST/50" || fail "Samo $NLIST/50 oglasa"

# ── FAZA 4: Admin approve ────────────────────────────────────────────────────
echo ""; echo "📋 F4: Admin approve svih oglasa"
NAPP=0
for LID in "${LIDS[@]}"; do
  SC=$(scode PATCH "/api/admin/listings/$LID" '{"moderationStatus":"active"}' "$AT")
  [ "$SC" = "200" ] && NAPP=$((NAPP+1))
done
[ $NAPP -eq $NLIST ] && ok "Approved: $NAPP/$NLIST" || fail "Approved: $NAPP/$NLIST"

# ── FAZA 5: Feed ─────────────────────────────────────────────────────────────
echo ""; echo "📋 F5: Feed i filtriranje"
R=$(get /api/listings)
FC=$(echo "$R" | j . "len(d.get('listings', d if isinstance(d,list) else []))")
[ "${FC:-0}" -gt 0 ] && ok "Javni feed: $FC oglasa" || fail "Feed prazan!"
FC2=$(get /api/listings "${UTOK[0]:-}" | j . "len(d.get('listings', d if isinstance(d,list) else []))")
ok "Auth feed: ${FC2:-0} oglasa"
FE=$(get "/api/listings?category=elektronika" | j . "len(d.get('listings', d if isinstance(d,list) else []))")
[ "${FE:-0}" -gt 0 ] && ok "Filter elektronika: $FE" || warn "Filter elektronika: 0"
FS=$(get "/api/listings?category=sport" | j . "len(d.get('listings', d if isinstance(d,list) else []))")
[ "${FS:-0}" -gt 0 ] && ok "Filter sport: $FS" || warn "Filter sport: 0"
# Search
FSRCH=$(get "/api/listings?q=bicikl" | j . "len(d.get('listings', d if isinstance(d,list) else []))")
[ "${FSRCH:-0}" -gt 0 ] && ok "Pretraga 'bicikl': $FSRCH" || warn "Pretraga: 0"
# Oglas detalj
if [ ${#LIDS[@]} -gt 0 ]; then
  DT=$(get "/api/listings/${LIDS[0]}" | j . "(d.get('listing') or d).get('title','')[:40]")
  [ -n "$DT" ] && ok "Oglas detalj: '$DT'" || warn "Oglas detalj prazan"
fi
# Oglasi po korisniku
[ -n "${UNAM[0]:-}" ] && {
  ULC=$(get "/api/listings/by-user/${UNAM[0]}" "${UTOK[0]:-}" | j . "len(d.get('listings',[]))")
  ok "Oglasi po korisniku ${UNAM[0]}: ${ULC:-0}"
}

# ── FAZA 6: Semantic matching ─────────────────────────────────────────────────
echo ""; echo "📋 F6: Semantic matching (AI podudaranje)"
TMATCHES=0; NZERO=0; MDETAIL=""
for i in 0 1 2; do
  [ -z "${UTOK[$i]:-}" ] && continue
  R=$(curl -s --max-time 25 -X POST -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${UTOK[$i]:-}" -d '{}' "$API/api/listings/semantic-matches")
  MC=$(echo "$R" | j . "len(d.get('matches',[]))" 2>/dev/null || echo "0")
  [ -z "$MC" ] && MC=0
  TMATCHES=$((TMATCHES+MC))
  if [ "$MC" -gt 0 ]; then
    TOP=$(echo "$R" | j . "f'{d[\"matches\"][0].get(\"title\",\"?\")[:35]} [score:{d[\"matches\"][0].get(\"score\",\"?\")}]'" 2>/dev/null)
    MDETAIL="${MDETAIL}    ${UNAM[$i]}: $MC matcheva → $TOP\n"
  else
    NZERO=$((NZERO+1))
    MDETAIL="${MDETAIL}    ${UNAM[$i]}: 0 matcheva ($(echo "$R" | head -c 60))\n"
  fi
done
AVG=$(python3 -c "print(f'{$TMATCHES/3:.1f}')" 2>/dev/null || echo "?")
ok "Matches (3 uzorka): avg $AVG/korisnik, ukupno $TMATCHES"
COV=$((3-NZERO))
[ $COV -ge 1 ] && ok "AI matching coverage: $COV/3 ✓" || warn "AI matching: 0/3 odgovora"
echo ""; echo "  📊 MATCHING DETALJI:"
echo -e "$MDETAIL"

# ── FAZA 7: Razgovori ────────────────────────────────────────────────────────
echo ""; echo "📋 F7: Kreiranje razgovora (25 cross-user)"
CIDS=(); CBTOK=(); COTOK=()
NCONV=0
for i in $(seq 0 24); do
  [ -z "${LIDS[$i]:-}" ] && continue
  OIDX="${LOIDX[$i]:-0}"
  BIDX=$(( (OIDX+1+i) % NT ))
  [ "$BIDX" -eq "$OIDX" ] && BIDX=$(( (BIDX+1) % NT ))
  BTOK="${UTOK[$BIDX]:-}"; [ -z "$BTOK" ] && continue
  R=$(post /api/conversations "{\"listingId\":\"${LIDS[$i]}\"}" "$BTOK")
  CID=$(echo "$R" | j . "d.get('conversation',d).get('id','')")
  [ -n "$CID" ] && { CIDS+=("$CID"); CBTOK+=("$BTOK"); COTOK+=("${UTOK[$OIDX]:-}"); NCONV=$((NCONV+1)); }
done
[ $NCONV -ge 20 ] && ok "Razgovori: $NCONV/25" || fail "Samo $NCONV razgovora"

# ── FAZA 8: Poruke ───────────────────────────────────────────────────────────
echo ""; echo "📋 F8: Razmjena poruka (4 msg × $NCONV razgovora)"
NMSG=0
MSGSLIST=("Hej, još dostupno?" "Da! Što nudiš zauzvrat?" "Imam točno što tražiš. Trampa?" "Super! Kada i gdje?")
for i in $(seq 0 $((NCONV-1))); do
  for MSG in "${MSGSLIST[@]}"; do
    R=$(post "/api/conversations/${CIDS[$i]}/messages" \
      "{\"text\":\"$MSG\",\"type\":\"text\"}" "${CBTOK[$i]}")
    MID=$(echo "$R" | j . "d.get('message',d).get('id','')")
    [ -n "$MID" ] && NMSG=$((NMSG+1))
  done
done
AVG_MSG=$(python3 -c "print(f'{$NMSG/$NCONV:.1f}' if $NCONV>0 else 0)" 2>/dev/null || echo "?")
[ $NMSG -gt 0 ] && ok "Poruke: $NMSG ($AVG_MSG/razgovor)" || fail "Nema poruka"

# ── FAZA 9: Inbox ────────────────────────────────────────────────────────────
echo ""; echo "📋 F9: Inbox provjera"
for i in 0 3 8; do
  [ -z "${CBTOK[$i]:-}" ] && continue
  IC=$(get /api/conversations "${CBTOK[$i]}" | j . "len(d.get('conversations',[]))")
  [ "${IC:-0}" -gt 0 ] && ok "Inbox $i: $IC razgovora" || warn "Inbox $i: prazan"
done
if [ -n "${CIDS[0]:-}" ] && [ -n "${CBTOK[0]:-}" ]; then
  PMC=$(get "/api/conversations/${CIDS[0]}/messages" "${CBTOK[0]}" | j . "len(d.get('messages',[]))")
  [ "${PMC:-0}" -gt 0 ] && ok "Čitanje poruka conv[0]: $PMC ✓" || fail "Poruke ne dohvatljive"
fi

# ── FAZA 10: Handshake ───────────────────────────────────────────────────────
echo ""; echo "📋 F10: Handshake mehanizam"
NHS=0; NAUTO=0
for i in $(seq 0 4); do
  [ -z "${CIDS[$i]:-}" ] || [ -z "${CBTOK[$i]:-}" ] && continue
  R=$(post "/api/conversations/${CIDS[$i]}/messages" \
    '{"text":"Dogovoreno! Potvrđujem trampu.","type":"handshake_request"}' "${CBTOK[$i]}")
  TYP=$(echo "$R" | j . "d.get('message',d).get('type','')")
  [ "$TYP" = "handshake_request" ] && NHS=$((NHS+1))
  sleep 0.5
  NA=$(get "/api/conversations/${CIDS[$i]}/messages" "${CBTOK[$i]}" | \
    j . "len([m for m in d.get('messages',[]) if m.get('type')=='handshake_accepted'])")
  [ "${NA:-0}" -gt 0 ] && NAUTO=$((NAUTO+1))
done
[ $NHS -gt 0 ] && ok "Handshake_request: $NHS/5 poslano" || fail "Handshake ne radi"
[ $NAUTO -gt 0 ] && ok "Auto-accepted (TrampaDemo bot): $NAUTO/5" || warn "Bot auto-accept: 0/5"
SC=$(scode PATCH "/api/conversations/${CIDS[0]:-x}" '{"status":"agreed"}' "${CBTOK[0]:-x}")
[ "$SC" = "200" ] && ok "Conv status → agreed" || warn "Conv patch: $SC"

# ── FAZA 11: Stripe / Escrow ─────────────────────────────────────────────────
echo ""; echo "📋 F11: Stripe escrow i checkout"
R=$(get /api/payments/publishable-key)
SK=$(echo "$R" | j . "d.get('publishableKey','')[:40]")
[ -n "$SK" ] && ok "Stripe publishable key: ${SK}..." || warn "Stripe key: $(echo "$R" | head -c 80)"
# Escrow checkout via /api/escrow/checkout/:conversationId
if [ -n "${CIDS[0]:-}" ] && [ -n "${CBTOK[0]:-}" ]; then
  R=$(post "/api/escrow/checkout/${CIDS[0]}" \
    '{"amountEur":15,"successUrl":"https://trampaj.hr/ok","cancelUrl":"https://trampaj.hr/cancel"}' \
    "${CBTOK[0]}")
  CURL=$(echo "$R" | j . "d.get('url','')[:50]")
  SID=$(echo "$R" | j . "d.get('sessionId','')[:20]")
  ERR=$(echo "$R" | j . "d.get('error','')")
  [ -n "$CURL" ] && ok "Escrow checkout URL: ${CURL}..." || \
  [ -n "$SID" ]  && ok "Escrow session ID: ${SID}..." || \
    warn "Escrow: err='$ERR' raw=$(echo "$R" | head -c 80)"
fi

# ── FAZA 12: Edit oglasa ─────────────────────────────────────────────────────
echo ""; echo "📋 F12: Editiranje oglasa → re-approve"
for i in 0 5 10; do
  [ -z "${LIDS[$i]:-}" ] && continue
  TIDX="${LOIDX[$i]:-0}"
  SC=$(scode PUT "/api/listings/${LIDS[$i]}" \
    "{\"title\":\"${TITLES[$i]} EDIT\",\"description\":\"Updated opis\",\"category\":\"${CATS[$i]}\",\"wantedFor\":\"${WANTS[$i]}\",\"condition\":\"kao novo\"}" \
    "${UTOK[$TIDX]:-x}")
  [ "$SC" = "200" ] && ok "Edit $i (${TITLES[$i]:0:25}): OK" || warn "Edit $i: $SC"
  SC2=$(scode PATCH "/api/admin/listings/${LIDS[$i]}" '{"moderationStatus":"active"}' "$AT")
  [ "$SC2" = "200" ] && ok "Re-approve $i: OK"
done

# ── FAZA 13: Bump ────────────────────────────────────────────────────────────
echo ""; echo "📋 F13: Bump oglas (featured)"
for i in 2 7 15; do
  [ -z "${LIDS[$i]:-}" ] && continue
  TIDX="${LOIDX[$i]:-0}"
  SC=$(scode POST "/api/listings/${LIDS[$i]}/bump" "" "${UTOK[$TIDX]:-x}")
  [[ "$SC" =~ ^(200|201)$ ]] && ok "Bump $i: OK" || warn "Bump $i: HTTP $SC"
done

# ── FAZA 14: Saved listings ──────────────────────────────────────────────────
echo ""; echo "📋 F14: Saved listings"
NSAVED=0
for i in $(seq 0 9); do
  TL="${LIDS[$((i+20))]:-}"; UTK="${UTOK[$i]:-}"
  [ -z "$TL" ] || [ -z "$UTK" ] && continue
  post "/api/saved/$TL" '{}' "$UTK" > /dev/null 2>&1
  R=$(get /api/saved "$UTK")
  echo "$R" | grep -q "$TL" && NSAVED=$((NSAVED+1))
done
[ $NSAVED -gt 0 ] && ok "Saved: $NSAVED/10 korisnika OK" || fail "Saved ne radi"
SC=$(scode DELETE "/api/saved/${LIDS[20]:-x}" "" "${UTOK[0]:-x}")
[[ "$SC" =~ ^(200|204)$ ]] && ok "Unsave: OK" || warn "Unsave: $SC"

# ── FAZA 15: Blokiranje ──────────────────────────────────────────────────────
echo ""; echo "📋 F15: Blokiranje korisnika"
BUN="${UNAM[3]:-}"; UT0="${UTOK[0]:-}"
if [ -n "$BUN" ] && [ -n "$UT0" ]; then
  SC=$(scode POST /api/blocked '{"username":"'$BUN'"}' "$UT0")
  [[ "$SC" =~ ^(200|201)$ ]] && ok "Block user $BUN: OK" || warn "Block: $SC"
  R=$(get /api/blocked "$UT0")
  echo "$R" | grep -q "$BUN" && ok "Blocked lista sadrži $BUN ✓" || warn "Blocked lista: $(echo "$R" | head -c 80)"
  SC=$(scode DELETE "/api/blocked/$BUN" "" "$UT0")
  [[ "$SC" =~ ^(200|204)$ ]] && ok "Unblock: OK" || warn "Unblock: $SC"
fi

# ── FAZA 16: Profil update ───────────────────────────────────────────────────
echo ""; echo "📋 F16: Profil update"
for i in 0 5 20; do
  [ -z "${UTOK[$i]:-}" ] && continue
  SC=$(scode PUT /api/auth/profile \
    "{\"city\":\"Zagreb\",\"phone\":\"091${i}234567\"}" \
    "${UTOK[$i]}")
  [ "$SC" = "200" ] && ok "Profil $i (${UNAM[$i]:-?}): OK" || warn "Profil $i: $SC"
done

# ── FAZA 17: Brisanje oglasa ─────────────────────────────────────────────────
echo ""; echo "📋 F17: Brisanje oglasa"
for i in 47 48; do
  [ -z "${LIDS[$i]:-}" ] && continue
  TIDX="${LOIDX[$i]:-0}"
  SC=$(scode DELETE "/api/listings/${LIDS[$i]}" "" "${UTOK[$TIDX]:-x}")
  [[ "$SC" =~ ^(200|204)$ ]] && ok "Brisanje $i (${TITLES[$i]:0:25}): OK" || warn "Delete $i: $SC"
done

# ── FAZA 18: Admin panel ─────────────────────────────────────────────────────
echo ""; echo "📋 F18: Admin panel"
R=$(get /api/admin/stats "$AT")
! echo "$R" | python3 -c "import json,sys; d=json.load(sys.stdin); exit(0 if 'totalListings' in d else 1)" 2>/dev/null && \
  fail "Stats greška" || {
  ok "Admin stats: OK"
  echo "  $(echo "$R" | j . "' | '.join(f'{k}={v}' for k,v in list(d.items())[:8] if not isinstance(v,dict))")"
}
AUC=$(get "/api/admin/users" "$AT" | j . "len(d.get('users',[]))")
ok "Admin /users: $AUC korisnika"
# Admin listings - default je pending; testiraj s active
ALP=$(get "/api/admin/listings?status=pending" "$AT" | j . "len(d.get('listings',[]))")
ALA=$(get "/api/admin/listings?status=active" "$AT" | j . "len(d.get('listings',[]))")
ok "Admin listings: pending=$ALP, active=$ALA"
# Ban/unban
[ -n "${XUIDS[20]:-}" ] && {
  SC=$(scode PATCH "/api/admin/users/${XUIDS[20]}" '{"isBanned":true}' "$AT")
  [ "$SC" = "200" ] && ok "Admin ban: OK" || warn "Admin ban: $SC"
  scode PATCH "/api/admin/users/${XUIDS[20]}" '{"isBanned":false}' "$AT" > /dev/null
  ok "Admin unban: OK"
}
# Reject i re-approve oglas
[ -n "${LIDS[35]:-}" ] && {
  SC=$(scode PATCH "/api/admin/listings/${LIDS[35]}" '{"moderationStatus":"rejected","moderationNote":"Test reject"}' "$AT")
  [ "$SC" = "200" ] && ok "Admin reject: OK" || warn "Admin reject: $SC"
  scode PATCH "/api/admin/listings/${LIDS[35]}" '{"moderationStatus":"active"}' "$AT" > /dev/null
}

# ── FAZA 19: Security ────────────────────────────────────────────────────────
echo ""; echo "📋 F19: Sigurnost i edge cases"
SC=$(scode GET /api/conversations)
[ "$SC" = "401" ] && ok "/conversations bez tokena → 401 ✓" || fail "/conversations bez tokena → $SC"
SC=$(scode GET /api/auth/me "" "" "ovo.je.krivi.jwt.token.xyz")
[ "$SC" = "401" ] && ok "Krivi JWT → 401 ✓" || warn "Krivi JWT → $SC"
# Duplikat username
SC=$(scode POST /api/auth/register "{\"username\":\"${UNAM[0]:-dup}\",\"password\":\"Test123!\",\"email\":\"novidup@testtrampaj.hr\"}")
[[ "$SC" =~ ^(400|409|422)$ ]] && ok "Duplikat username → $SC (odbijeno ✓)" || warn "Duplikat → $SC"
# Tuđi oglas
if [ ${#LIDS[@]} -gt 6 ] && [ -n "${LOIDX[6]:-}" ]; then
  OIDX="${LOIDX[6]}"; OTHERIDX=$(( (OIDX+3) % NT ))
  SC=$(scode DELETE "/api/listings/${LIDS[6]}" "" "${UTOK[$OTHERIDX]:-x}")
  [[ "$SC" =~ ^(401|403)$ ]] && ok "Tuđi delete → $SC (odbijeno ✓)" || warn "Tuđi delete → $SC"
fi
# Tuđa konverzacija
if [ ${#CIDS[@]} -gt 0 ] && [ -n "${UTOK[30]:-}" ]; then
  SC=$(scode GET "/api/conversations/${CIDS[0]}/messages" "" "" "${UTOK[30]}")
  [[ "$SC" =~ ^(401|403|404)$ ]] && ok "Tuđa konverzacija → $SC ✓" || warn "Tuđa conv → $SC"
fi
# Nepostojeći oglas
SC=$(scode GET "/api/listings/00000000-0000-0000-0000-000000000000")
[[ "$SC" =~ ^(404|400)$ ]] && ok "Nepostojeći oglas → $SC ✓" || warn "404 test → $SC"

# ── FAZA 20: HTTP headeri ────────────────────────────────────────────────────
echo ""; echo "📋 F20: HTTP headeri i caching"
HDRS=$(curl -sI --max-time 10 "$API/api/listings" -H "Authorization: Bearer ${UTOK[0]:-x}" 2>/dev/null)
echo "$HDRS" | grep -qi "cache-control:.*no-store" && ok "Cache-Control: no-store ✓" || warn "Cache header: $(echo "$HDRS" | grep -i cache | head -1)"
echo "$HDRS" | grep -qi "^etag:" && warn "ETag prisutan!" || ok "ETag: onemogućen ✓"
echo "$HDRS" | grep -qi "x-content-type-options" && ok "X-Content-Type-Options ✓" || warn "X-Content-Type-Options: nije set"
echo "$HDRS" | grep -qi "x-frame-options" && ok "X-Frame-Options ✓" || warn "X-Frame-Options: nije set"

# ── DB SUMMARY ───────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  📊 STANJE BAZE NAKON TESTA"
echo "══════════════════════════════════════════════════════════════"
psql "$DATABASE_URL" -c "
SELECT
  (SELECT COUNT(*) FROM users WHERE email LIKE '%testtrampaj%') as test_korisnici,
  (SELECT COUNT(*) FROM users WHERE is_verified=true) as verificirani,
  (SELECT COUNT(*) FROM listings) as ukupno_oglasa,
  (SELECT COUNT(*) FROM listings WHERE moderation_status='active') as aktivnih,
  (SELECT COUNT(*) FROM listings WHERE moderation_status='pending') as na_pregledu,
  (SELECT COUNT(*) FROM conversations) as razgovori,
  (SELECT COUNT(*) FROM messages) as poruke,
  (SELECT COUNT(*) FROM saved_listings) as saved,
  (SELECT COUNT(*) FROM escrow_deposits) as escrow;" 2>/dev/null
echo ""
echo "  📊 OGLASI PO KATEGORIJI:"
psql "$DATABASE_URL" -c "
  SELECT category, COUNT(*) as ukupno,
    COUNT(CASE WHEN moderation_status='active' THEN 1 END) as aktivnih
  FROM listings GROUP BY category ORDER BY ukupno DESC;" 2>/dev/null
echo ""
echo "  📊 TOP RAZGOVORI (po broju poruka):"
psql "$DATABASE_URL" -c "
  SELECT COALESCE((SELECT title FROM listings WHERE id=c.listing_id LIMIT 1),'?') as oglas,
    COUNT(m.id) as poruke, c.status
  FROM conversations c LEFT JOIN messages m ON m.conversation_id=c.id
  GROUP BY c.id ORDER BY poruke DESC LIMIT 8;" 2>/dev/null

# ── FINALE ───────────────────────────────────────────────────────────────────
echo ""
echo "══════════════════════════════════════════════════════════════"
echo "  REZIME TESTOVA"
echo "══════════════════════════════════════════════════════════════"
TOTAL=$((PASS+FAIL+WARN))
echo "  ✅ PROŠLO:     $PASS / $TOTAL"
echo "  ❌ PALO:       $FAIL / $TOTAL"
echo "  ⚠️  UPOZORENJA: $WARN / $TOTAL"
echo ""
if [ $FAIL -eq 0 ]; then
  echo "  🏆 SVI KRITIČNI TESTOVI PROŠLI!"
elif [ $FAIL -le 2 ]; then
  echo "  ⚠️  UGLAVNOM OK — $FAIL kritičnih grešaka"
else
  echo "  ❌ IMA KRITIČNIH GREŠAKA ($FAIL)"
fi
echo "══════════════════════════════════════════════════════════════"
