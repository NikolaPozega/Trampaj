import { Router, type IRouter } from "express";

const router: IRouter = Router();

const CATEGORIES = ["Elektronika","Odjeća i obuća","Sport i rekreacija","Knjige i obrazovanje","Dom i vrt","Igre i igračke","Vozila","Ostalo"];
const CAT_COLORS: Record<string,string> = {
  "Elektronika":"#38BDF8","Odjeća i obuća":"#f472b6","Sport i rekreacija":"#34d399",
  "Knjige i obrazovanje":"#a78bfa","Dom i vrt":"#fb923c","Igre i igračke":"#facc15",
  "Vozila":"#94a3b8","Ostalo":"#64748b",
};

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

function catColor(cat: string) { return CAT_COLORS[cat] ?? "#64748b"; }

const SHARED_CSS = `
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{min-height:100%;background:#08152E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff}
  a{color:inherit;text-decoration:none}
  .nav{position:sticky;top:0;z-index:100;background:rgba(8,21,46,.95);backdrop-filter:blur(10px);border-bottom:1px solid rgba(255,255,255,.08);padding:0 16px}
  .nav-inner{max-width:700px;margin:0 auto;display:flex;align-items:center;gap:4px;height:52px}
  .nav-logo{font-weight:900;font-size:1.1rem;color:#38BDF8;margin-right:auto;display:flex;align-items:center;gap:8px}
  .nav-logo svg{width:28px;height:28px;border-radius:7px}
  .nav-link{padding:6px 12px;border-radius:8px;font-size:.82rem;font-weight:600;color:rgba(255,255,255,.55);transition:.15s;white-space:nowrap}
  .nav-link:hover,.nav-link.active{color:#fff;background:rgba(255,255,255,.08)}
  .nav-link.active{color:#F5C100}
  .wrap{max-width:700px;margin:0 auto;padding:16px}
  .card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:16px}
  .pill{display:inline-block;padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:700;color:#fff}
  .btn{display:inline-block;padding:11px 20px;border:none;border-radius:11px;font-weight:700;font-size:.9rem;cursor:pointer;transition:.15s;text-align:center}
  .btn-yellow{background:#F5C100;color:#08152E}
  .btn-yellow:hover{background:#ffd426}
  .btn-ghost{background:rgba(255,255,255,.07);color:rgba(255,255,255,.7);border:1px solid rgba(255,255,255,.1)}
  .btn-ghost:hover{background:rgba(255,255,255,.12)}
  .btn-red{background:rgba(239,68,68,.15);color:#fca5a5;border:1px solid rgba(239,68,68,.2)}
  .btn-red:hover{background:rgba(239,68,68,.25)}
  .input{width:100%;padding:11px 14px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:#fff;font-size:.9rem;outline:none;transition:.15s}
  .input:focus{border-color:#38BDF8;background:rgba(56,189,248,.06)}
  .input::placeholder{color:rgba(255,255,255,.3)}
  select.input option{background:#0f2040;color:#fff}
  .label{display:block;font-size:.75rem;font-weight:600;color:rgba(255,255,255,.45);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px}
  .field{margin-bottom:14px}
  .msg{padding:12px;border-radius:10px;font-size:.88rem;margin-top:10px;display:none}
  .msg.ok{background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.3);color:#86efac}
  .msg.err{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:#fca5a5}
  .loader{text-align:center;color:rgba(255,255,255,.35);padding:60px 0;font-size:.9rem}
  .empty{text-align:center;padding:60px 20px;color:rgba(255,255,255,.35)}
  .empty-icon{font-size:3rem;margin-bottom:12px}
  .divider{height:1px;background:rgba(255,255,255,.06);margin:12px 0}
`;

function NAV(active: string): string {
  const link = (href: string, label: string, id: string) =>
    `<a href="${href}" class="nav-link${active===id?' active':''}">${label}</a>`;
  return `
<nav class="nav">
  <div class="nav-inner">
    <a href="/oglasi" class="nav-logo">
      <svg viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="140" height="140" fill="#08152E" rx="28"/>
        <rect x="22" y="32" width="52" height="52" rx="10" stroke="#38BDF8" stroke-width="5" fill="none"/>
        <rect x="66" y="56" width="52" height="52" rx="10" stroke="#F5C100" stroke-width="5" fill="none"/>
      </svg>
      Trampaj
    </a>
    ${link("/oglasi","Oglasi","oglasi")}
    ${link("/objavi","+ Objavi","objavi")}
    ${link("/razgovori","💬","razgovori")}
    ${link("/profil","Profil","profil")}
  </div>
</nav>`;
}

function PAGE(title: string, active: string, body: string, script: string = ""): string {
  return `<!DOCTYPE html>
<html lang="hr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${esc(title)} — Trampaj.hr</title>
  <style>${SHARED_CSS}</style>
</head>
<body>
${NAV(active)}
<div class="wrap">${body}</div>
<script>
function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function getToken(){return localStorage.getItem('trampaj_token')}
function requireAuth(){var t=getToken();if(!t){window.location.href='/prijava';return null;}return t;}
function authHeaders(){return{'Authorization':'Bearer '+getToken(),'Content-Type':'application/json'}}
function showMsg(id,msg,ok){var el=document.getElementById(id);if(!el)return;el.textContent=msg;el.className='msg '+(ok?'ok':'err');el.style.display='block';}
function timeAgo(ms){var diff=Date.now()-ms;if(diff<60000)return'upravo';if(diff<3600000)return Math.floor(diff/60000)+'min';if(diff<86400000)return Math.floor(diff/3600000)+'h';return Math.floor(diff/86400000)+'d';}
var CAT_COLORS=${JSON.stringify(CAT_COLORS)};
function catPill(cat){var c=CAT_COLORS[cat]||'#64748b';return'<span class="pill" style="background:'+c+'20;color:'+c+';border:1px solid '+c+'40">'+esc(cat)+'</span>';}
${script}
</script>
</body>
</html>`;
}

// ─── /oglasi ──────────────────────────────────────────────────────────────────
router.get("/oglasi", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'");
  const catPills = ["Sve", ...CATEGORIES].map(c =>
    `<button class="cat-pill" data-cat="${esc(c)}">${esc(c)}</button>`
  ).join("");

  res.send(PAGE("Oglasi", "oglasi", `
<div style="margin-bottom:14px">
  <input id="search" class="input" placeholder="🔍 Pretraži oglase..." style="margin-bottom:10px"/>
  <div id="cats" style="display:flex;gap:6px;flex-wrap:wrap">${catPills}</div>
</div>
<div id="grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
  <div class="loader">Učitavam oglase...</div>
</div>
<style>
  .cat-pill{padding:6px 14px;border-radius:20px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.05);color:rgba(255,255,255,.6);font-size:.78rem;font-weight:600;cursor:pointer;transition:.15s}
  .cat-pill:hover,.cat-pill.active{background:#38BDF820;border-color:#38BDF8;color:#38BDF8}
  .listing-card{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:14px;padding:14px;cursor:pointer;transition:.15s;display:flex;flex-direction:column;gap:8px}
  .listing-card:hover{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.15);transform:translateY(-1px)}
  .listing-title{font-weight:700;font-size:.95rem;line-height:1.3}
  .listing-desc{font-size:.8rem;color:rgba(255,255,255,.5);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
  .listing-wanted{font-size:.78rem;color:#38BDF8;font-weight:600}
  .listing-meta{display:flex;justify-content:space-between;font-size:.72rem;color:rgba(255,255,255,.35);margin-top:4px}
</style>
`, `
document.addEventListener('DOMContentLoaded', function() {
  var activeCat = 'Sve';
  var searchTerm = '';
  var debounce;

  document.querySelectorAll('.cat-pill').forEach(function(btn) {
    if (btn.dataset.cat === 'Sve') btn.classList.add('active');
    btn.addEventListener('click', function() {
      activeCat = this.dataset.cat;
      document.querySelectorAll('.cat-pill').forEach(function(b){ b.classList.remove('active'); });
      this.classList.add('active');
      loadListings();
    });
  });

  document.getElementById('search').addEventListener('input', function() {
    clearTimeout(debounce);
    searchTerm = this.value;
    debounce = setTimeout(loadListings, 300);
  });

  function loadListings() {
    var grid = document.getElementById('grid');
    grid.innerHTML = '<div class="loader">Učitavam...</div>';
    var params = new URLSearchParams();
    if (activeCat !== 'Sve') params.set('category', activeCat);
    if (searchTerm.trim()) params.set('search', searchTerm.trim());
    var token = getToken();
    var headers = token ? {'Authorization': 'Bearer ' + token} : {};
    fetch('/api/listings?' + params.toString(), {headers: headers})
      .then(function(r){ return r.json(); })
      .then(function(d) {
        var listings = d.listings || [];
        if (!listings.length) {
          grid.innerHTML = '<div class="empty"><div class="empty-icon">📦</div><div>Nema oglasa</div></div>';
          return;
        }
        grid.innerHTML = listings.map(function(l) {
          return '<div class="listing-card" onclick="window.location.href=\'/oglas/'+esc(l.id)+'\'">' +
            catPill(l.category) +
            '<div class="listing-title">' + esc(l.title) + '</div>' +
            '<div class="listing-desc">' + esc(l.description) + '</div>' +
            '<div class="listing-wanted">⇄ ' + esc(l.wantedFor || 'Otvoreno') + '</div>' +
            '<div class="listing-meta"><span>📍 ' + esc(l.location || 'HR') + '</span><span>' + timeAgo(l.createdAt) + '</span></div>' +
          '</div>';
        }).join('');
      })
      .catch(function(){ grid.innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><div>Greška pri učitavanju</div></div>'; });
  }

  loadListings();
});
`));
});

// ─── /oglas/:id ───────────────────────────────────────────────────────────────
router.get("/oglas/:id", (req, res) => {
  const id = esc(req.params["id"] ?? "");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'");
  res.send(PAGE("Oglas", "", `
<div style="margin-bottom:12px">
  <a href="/oglasi" style="color:rgba(255,255,255,.5);font-size:.85rem;font-weight:600">← Natrag</a>
</div>
<div id="detail" class="loader">Učitavam oglas...</div>
<style>
  .oglas-img{width:100%;max-height:280px;object-fit:cover;border-radius:12px;margin-bottom:14px;display:block}
  .oglas-img-placeholder{width:100%;height:180px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:3rem;margin-bottom:14px;color:rgba(255,255,255,.15)}
  .oglas-title{font-size:1.3rem;font-weight:800;margin:10px 0 6px}
  .oglas-desc{color:rgba(255,255,255,.7);font-size:.9rem;line-height:1.6;margin-bottom:14px}
  .oglas-wanted{background:rgba(56,189,248,.08);border:1px solid rgba(56,189,248,.2);border-radius:10px;padding:12px 14px;margin-bottom:14px}
  .oglas-wanted-label{font-size:.7rem;font-weight:700;color:#38BDF8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px}
  .oglas-wanted-val{font-weight:600;color:#e0f2fe}
  .oglas-meta{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px}
  .oglas-meta-item{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:6px 12px;font-size:.78rem;color:rgba(255,255,255,.6)}
  .oglas-user{display:flex;align-items:center;gap:10px;margin-bottom:20px}
  .oglas-avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#38BDF8,#0f4f7a);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.95rem;flex-shrink:0}
  .action-row{display:flex;flex-direction:column;gap:10px}
</style>
`, `
document.addEventListener('DOMContentLoaded', function() {
  var listingId = '${id}';
  var token = getToken();
  var headers = token ? {'Authorization': 'Bearer ' + token} : {};

  fetch('/api/listings/' + listingId, {headers: headers})
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (!d.listing) { document.getElementById('detail').innerHTML = '<div class="empty"><div class="empty-icon">😕</div><div>Oglas nije pronađen</div></div>'; return; }
      var l = d.listing;
      var imgs = Array.isArray(l.imageUris) ? l.imageUris : [];
      var imgHtml = imgs.length
        ? '<img class="oglas-img" src="' + esc(imgs[0]) + '" onerror="this.style.display=\'none\'">'
        : '<div class="oglas-img-placeholder">📦</div>';
      var cond = {'novo':'🆕 Novo','kao novo':'✨ Kao novo','dobro':'👍 Dobro','prihvatljivo':'✅ Prihvatljivo'}[l.condition] || l.condition || '';
      var joined = l.createdAt ? new Date(l.createdAt).toLocaleDateString('hr-HR',{day:'numeric',month:'long',year:'numeric'}) : '';
      var initials = ((l.userName||'U')+'?').substring(0,2).toUpperCase();

      var actionHtml = '';
      if (!token) {
        actionHtml = '<a href="/prijava" class="btn btn-yellow" style="width:100%;display:block">Prijavi se za trampu</a>';
      } else if (l.isMine) {
        actionHtml =
          '<div style="padding:10px;background:rgba(245,193,0,.08);border:1px solid rgba(245,193,0,.2);border-radius:10px;text-align:center;font-size:.85rem;color:#F5C100">To je tvoj oglas</div>' +
          '<div style="display:flex;gap:8px">' +
          '<button class="btn btn-ghost" style="flex:1" onclick="markTraded(\''+esc(l.id)+'\')">Označi kao trampu ✓</button>' +
          '<button class="btn btn-red" style="flex:1" onclick="deleteListng(\''+esc(l.id)+'\')">Obriši</button>' +
          '</div>';
      } else {
        actionHtml = '<button class="btn btn-yellow" style="width:100%" onclick="startChat(\''+esc(l.id)+'\')">⇄ Ponudi trampu</button>';
      }

      document.getElementById('detail').innerHTML =
        imgHtml +
        catPill(l.category) +
        '<div class="oglas-title">' + esc(l.title) + '</div>' +
        '<div class="oglas-desc">' + esc(l.description) + '</div>' +
        (l.wantedFor ? '<div class="oglas-wanted"><div class="oglas-wanted-label">Traži u zamjenu</div><div class="oglas-wanted-val">' + esc(l.wantedFor) + '</div></div>' : '') +
        '<div class="oglas-meta">' +
          (l.location ? '<span class="oglas-meta-item">📍 ' + esc(l.location) + '</span>' : '') +
          (cond ? '<span class="oglas-meta-item">' + esc(cond) + '</span>' : '') +
          (joined ? '<span class="oglas-meta-item">📅 ' + joined + '</span>' : '') +
        '</div>' +
        '<div class="oglas-user"><div class="oglas-avatar">' + esc(initials) + '</div><div><div style="font-weight:700">' + esc(l.userName||'') + '</div><div style="font-size:.75rem;color:rgba(255,255,255,.4)">Prodavač</div></div></div>' +
        '<div class="divider"></div>' +
        '<div class="action-row" id="actions">' + actionHtml + '</div>' +
        '<div id="act-msg" class="msg"></div>';
    })
    .catch(function(){ document.getElementById('detail').innerHTML='<div class="empty"><div class="empty-icon">⚠️</div><div>Greška pri učitavanju</div></div>'; });

  window.startChat = function(lid) {
    var t = requireAuth(); if (!t) return;
    fetch('/api/conversations', {method:'POST', headers:authHeaders(), body:JSON.stringify({listingId:lid})})
      .then(function(r){ return r.json(); })
      .then(function(d) {
        if (d.conversation) { window.location.href = '/razgovor/' + d.conversation.id; }
        else { showMsg('act-msg', d.error||'Greška', false); }
      })
      .catch(function(){ showMsg('act-msg','Greška pri spajanju',false); });
  };
  window.markTraded = function(lid) {
    fetch('/api/listings/'+lid+'/status', {method:'PATCH', headers:authHeaders(), body:JSON.stringify({status:'traded'})})
      .then(function(r){ return r.json(); })
      .then(function(d){ if(d.listing||d.ok){ showMsg('act-msg','Označeno kao trampa ✓',true); }else{ showMsg('act-msg',d.error||'Greška',false); } })
      .catch(function(){ showMsg('act-msg','Greška',false); });
  };
  window.deleteListng = function(lid) {
    if (!confirm('Obrisati oglas?')) return;
    fetch('/api/listings/'+lid, {method:'DELETE', headers:authHeaders()})
      .then(function(r){ if(r.ok){ window.location.href='/profil'; }else{ return r.json().then(function(d){ showMsg('act-msg',d.error||'Greška',false); }); } })
      .catch(function(){ showMsg('act-msg','Greška',false); });
  };
});
`));
});

// ─── /objavi ──────────────────────────────────────────────────────────────────
router.get("/objavi", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'");
  const catOptions = CATEGORIES.map(c => `<option value="${esc(c)}">${esc(c)}</option>`).join("");
  res.send(PAGE("Objavi oglas", "objavi", `
<h2 style="font-size:1.2rem;font-weight:800;margin-bottom:18px">Novi oglas</h2>
<div class="card">
  <div class="field">
    <label class="label" for="title">Naslov *</label>
    <input id="title" class="input" placeholder="Npr. iPhone 13 128GB"/>
  </div>
  <div class="field">
    <label class="label" for="desc">Opis *</label>
    <textarea id="desc" class="input" rows="4" placeholder="Opiši predmet — stanje, dimenzije, detalji..."></textarea>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
    <div class="field">
      <label class="label" for="cat">Kategorija *</label>
      <select id="cat" class="input">${catOptions}</select>
    </div>
    <div class="field">
      <label class="label" for="cond">Stanje</label>
      <select id="cond" class="input">
        <option value="">— nije navedeno</option>
        <option value="novo">🆕 Novo</option>
        <option value="kao novo">✨ Kao novo</option>
        <option value="dobro">👍 Dobro</option>
        <option value="prihvatljivo">✅ Prihvatljivo</option>
      </select>
    </div>
  </div>
  <div class="field">
    <label class="label" for="wanted">Što tražiš u zamjenu *</label>
    <input id="wanted" class="input" placeholder="Npr. laptop, bicikl, slušalice..."/>
  </div>
  <div class="field">
    <label class="label" for="loc">Lokacija</label>
    <input id="loc" class="input" placeholder="Npr. Zagreb, Split..."/>
  </div>
  <div id="form-msg" class="msg"></div>
  <button id="submit-btn" class="btn btn-yellow" style="width:100%;margin-top:6px">Objavi oglas</button>
</div>
`, `
document.addEventListener('DOMContentLoaded', function() {
  var t = requireAuth(); if (!t) return;

  document.getElementById('submit-btn').addEventListener('click', function() {
    var btn = this;
    var title = document.getElementById('title').value.trim();
    var desc = document.getElementById('desc').value.trim();
    var cat = document.getElementById('cat').value;
    var cond = document.getElementById('cond').value;
    var wanted = document.getElementById('wanted').value.trim();
    var loc = document.getElementById('loc').value.trim();

    if (!title || !desc || !wanted) { showMsg('form-msg','Popuni obavezna polja (naslov, opis, zamjena)',false); return; }

    btn.disabled = true; btn.textContent = 'Objavljujem...';
    fetch('/api/listings', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({title:title, description:desc, category:cat, condition:cond||null, wantedFor:wanted, location:loc||'Hrvatska'})
    })
    .then(function(r){ return r.json().then(function(d){ return {ok:r.ok,d:d}; }); })
    .then(function(res) {
      if (!res.ok) { showMsg('form-msg', res.d.error||'Greška', false); btn.disabled=false; btn.textContent='Objavi oglas'; return; }
      showMsg('form-msg', '✓ Oglas objavljen! Preusmjeravam...', true);
      setTimeout(function(){ window.location.href = '/oglas/' + res.d.listing.id; }, 800);
    })
    .catch(function(){ showMsg('form-msg','Greška pri spajanju',false); btn.disabled=false; btn.textContent='Objavi oglas'; });
  });
});
`));
});

// ─── /razgovori ───────────────────────────────────────────────────────────────
router.get("/razgovori", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'");
  res.send(PAGE("Razgovori", "razgovori", `
<h2 style="font-size:1.2rem;font-weight:800;margin-bottom:16px">Razgovori</h2>
<div id="list" class="loader">Učitavam razgovore...</div>
<style>
  .conv-item{display:flex;align-items:center;gap:12px;padding:14px;border-radius:12px;cursor:pointer;border:1px solid rgba(255,255,255,.07);background:rgba(255,255,255,.03);margin-bottom:8px;transition:.15s}
  .conv-item:hover{background:rgba(255,255,255,.07);border-color:rgba(255,255,255,.15)}
  .conv-avatar{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,#38BDF8,#0f4f7a);display:flex;align-items:center;justify-content:center;font-weight:800;flex-shrink:0}
  .conv-body{flex:1;min-width:0}
  .conv-user{font-weight:700;font-size:.9rem}
  .conv-listing{font-size:.75rem;color:rgba(255,255,255,.4);margin-bottom:2px}
  .conv-last{font-size:.8rem;color:rgba(255,255,255,.55);overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  .conv-time{font-size:.7rem;color:rgba(255,255,255,.3);flex-shrink:0}
</style>
`, `
document.addEventListener('DOMContentLoaded', function() {
  var t = requireAuth(); if (!t) return;
  fetch('/api/conversations', {headers:{'Authorization':'Bearer '+t}})
    .then(function(r){ return r.json(); })
    .then(function(d) {
      var convs = d.conversations || [];
      if (!convs.length) {
        document.getElementById('list').innerHTML = '<div class="empty"><div class="empty-icon">💬</div><div>Nema razgovora</div><div style="margin-top:8px"><a href="/oglasi" class="btn btn-ghost" style="font-size:.85rem">Pronađi oglas</a></div></div>';
        return;
      }
      convs.sort(function(a,b){ return b.updatedAt - a.updatedAt; });
      document.getElementById('list').innerHTML = convs.map(function(c) {
        var initials = ((c.otherUserName||'K')+'?').substring(0,2).toUpperCase();
        var lastMsg = c.messages && c.messages.length ? c.messages[c.messages.length-1] : null;
        var preview = lastMsg ? (lastMsg.fromMe ? 'Ti: ' : '') + lastMsg.text : 'Nema poruka';
        return '<div class="conv-item" onclick="window.location.href=\'/razgovor/'+esc(c.id)+'\'">' +
          '<div class="conv-avatar">'+esc(initials)+'</div>' +
          '<div class="conv-body">' +
            '<div class="conv-user">'+esc(c.otherUserName||'Korisnik')+'</div>' +
            '<div class="conv-listing">re: '+esc(c.listingTitle||'Oglas')+'</div>' +
            '<div class="conv-last">'+esc(preview)+'</div>' +
          '</div>' +
          '<div class="conv-time">'+timeAgo(c.updatedAt)+'</div>' +
          '</div>';
      }).join('');
    })
    .catch(function(){ document.getElementById('list').innerHTML='<div class="empty"><div class="empty-icon">⚠️</div><div>Greška pri učitavanju</div></div>'; });
});
`));
});

// ─── /razgovor/:id ────────────────────────────────────────────────────────────
router.get("/razgovor/:id", (req, res) => {
  const convId = esc(req.params["id"] ?? "");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'");
  res.send(PAGE("Razgovor", "razgovori", `
<div style="margin-bottom:10px;display:flex;align-items:center;gap:10px">
  <a href="/razgovori" style="color:rgba(255,255,255,.5);font-size:.85rem;font-weight:600">← Razgovori</a>
  <div id="chat-header" style="font-weight:700;font-size:.9rem;color:rgba(255,255,255,.8)"></div>
</div>
<div id="msgs" style="display:flex;flex-direction:column;gap:8px;min-height:300px;max-height:55vh;overflow-y:auto;padding:4px 0;margin-bottom:12px">
  <div class="loader">Učitavam...</div>
</div>
<div style="display:flex;gap:8px;position:sticky;bottom:0;background:#08152E;padding:8px 0">
  <input id="msg-input" class="input" placeholder="Napiši poruku..." style="flex:1" autocomplete="off"/>
  <button id="send-btn" class="btn btn-yellow" style="flex-shrink:0;padding:11px 18px">→</button>
</div>
<style>
  .bubble{max-width:78%;padding:9px 13px;border-radius:14px;font-size:.88rem;line-height:1.5;word-break:break-word}
  .bubble-mine{align-self:flex-end;background:#F5C100;color:#08152E;border-bottom-right-radius:4px}
  .bubble-theirs{align-self:flex-start;background:rgba(255,255,255,.08);color:#fff;border-bottom-left-radius:4px}
  .bubble-time{font-size:.65rem;opacity:.5;margin-top:3px;text-align:right}
</style>
`, `
document.addEventListener('DOMContentLoaded', function() {
  var t = requireAuth(); if (!t) return;
  var convId = '${convId}';
  var lastMsgCount = 0;
  var pollInterval;

  function loadMessages(scroll) {
    fetch('/api/conversations/'+convId+'/messages', {headers:{'Authorization':'Bearer '+t}})
      .then(function(r){ return r.json(); })
      .then(function(d) {
        var msgs = d.messages || [];
        if (msgs.length === lastMsgCount && !scroll) return;
        lastMsgCount = msgs.length;
        var el = document.getElementById('msgs');
        if (!msgs.length) { el.innerHTML='<div class="empty" style="padding:40px 0">Nema poruka — pošalji prvu!</div>'; return; }
        el.innerHTML = msgs.map(function(m) {
          var mine = m.fromMe;
          var t2 = new Date(m.createdAt).toLocaleTimeString('hr-HR',{hour:'2-digit',minute:'2-digit'});
          return '<div class="bubble '+(mine?'bubble-mine':'bubble-theirs')+'">' +
            esc(m.text) +
            '<div class="bubble-time">'+t2+'</div>' +
          '</div>';
        }).join('');
        if (scroll) el.scrollTop = el.scrollHeight;
      })
      .catch(function(){});
  }

  function loadConv() {
    fetch('/api/conversations', {headers:{'Authorization':'Bearer '+t}})
      .then(function(r){ return r.json(); })
      .then(function(d) {
        var c = (d.conversations||[]).find(function(x){ return x.id===convId; });
        if (c) document.getElementById('chat-header').textContent = c.otherUserName + ' • ' + (c.listingTitle||'Oglas');
      }).catch(function(){});
  }

  function sendMsg() {
    var inp = document.getElementById('msg-input');
    var text = inp.value.trim();
    if (!text) return;
    inp.value = '';
    fetch('/api/conversations/'+convId+'/messages', {
      method:'POST', headers:authHeaders(),
      body: JSON.stringify({text:text, type:'text'})
    })
    .then(function(r){ return r.json(); })
    .then(function(){ loadMessages(true); })
    .catch(function(){});
  }

  document.getElementById('send-btn').addEventListener('click', sendMsg);
  document.getElementById('msg-input').addEventListener('keydown', function(e) {
    if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  });

  loadConv();
  loadMessages(true);
  pollInterval = setInterval(function(){ loadMessages(false); }, 3000);

  window.addEventListener('beforeunload', function(){ clearInterval(pollInterval); });
});
`));
});

// ─── /profil ──────────────────────────────────────────────────────────────────
router.get("/profil", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'");
  res.send(PAGE("Moj profil", "profil", `
<div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
  <div id="p-avatar" style="width:60px;height:60px;border-radius:50%;background:linear-gradient(135deg,#38BDF8,#0f4f7a);display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:800;flex-shrink:0">?</div>
  <div>
    <div id="p-name" style="font-size:1.2rem;font-weight:800">Učitavam...</div>
    <div id="p-email" style="font-size:.82rem;color:rgba(255,255,255,.4)"></div>
    <div id="p-joined" style="font-size:.75rem;color:rgba(255,255,255,.3);margin-top:2px"></div>
  </div>
  <button id="btn-odjava" class="btn btn-ghost" style="margin-left:auto;font-size:.8rem;padding:8px 14px">Odjava</button>
</div>
<a href="/objavi" class="btn btn-yellow" style="display:block;width:100%;margin-bottom:20px;text-align:center">+ Objavi novi oglas</a>
<h3 style="font-size:.85rem;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px">Moji oglasi</h3>
<div id="my-listings" class="loader">Učitavam...</div>
<style>
  .my-listing{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding:12px 14px;border-radius:12px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);margin-bottom:8px;cursor:pointer;transition:.15s}
  .my-listing:hover{background:rgba(255,255,255,.07)}
  .my-listing-body{flex:1;min-width:0}
  .my-listing-title{font-weight:700;font-size:.9rem;margin-bottom:3px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
  .my-listing-sub{font-size:.75rem;color:rgba(255,255,255,.4)}
  .status-badge{padding:3px 9px;border-radius:10px;font-size:.7rem;font-weight:700;white-space:nowrap;flex-shrink:0}
  .status-active{background:rgba(34,197,94,.15);color:#86efac;border:1px solid rgba(34,197,94,.25)}
  .status-traded{background:rgba(245,193,0,.12);color:#F5C100;border:1px solid rgba(245,193,0,.25)}
  .status-pending{background:rgba(148,163,184,.1);color:#94a3b8;border:1px solid rgba(148,163,184,.2)}
</style>
`, `
document.addEventListener('DOMContentLoaded', function() {
  var t = requireAuth(); if (!t) return;

  fetch('/api/auth/me', {headers: {'Authorization':'Bearer '+t}, cache:'no-store'})
    .then(function(r){ return r.json(); })
    .then(function(d) {
      if (!d.user) { localStorage.removeItem('trampaj_token'); window.location.href='/prijava'; return; }
      var u = d.user;
      var initials = ((u.username||'U')+'?').substring(0,2).toUpperCase();
      document.getElementById('p-avatar').textContent = initials;
      document.getElementById('p-name').textContent = u.username || '';
      document.getElementById('p-email').textContent = u.email || '';
      try {
        document.getElementById('p-joined').textContent = 'Član od ' + new Date(u.createdAt).toLocaleDateString('hr-HR',{day:'numeric',month:'long',year:'numeric'});
      } catch(e) {}

      document.getElementById('btn-odjava').addEventListener('click', function() {
        localStorage.removeItem('trampaj_token');
        window.location.href = '/prijava';
      });

      return fetch('/api/listings/by-user/'+encodeURIComponent(u.username), {headers:{'Authorization':'Bearer '+t}});
    })
    .then(function(r){ if (!r) return; return r.json(); })
    .then(function(d) {
      if (!d) return;
      var listings = d.listings || [];
      var el = document.getElementById('my-listings');
      if (!listings.length) {
        el.innerHTML = '<div class="empty"><div class="empty-icon">📦</div><div>Nemaš još nijedan oglas</div></div>';
        return;
      }
      var statusLabel = {'active':'Aktivan','traded':'Trampa!','pending':'Na čekanju','rejected':'Odbijen'};
      var statusCls = {'active':'status-active','traded':'status-traded','pending':'status-pending','rejected':'status-pending'};
      el.innerHTML = listings.map(function(l) {
        var label = statusLabel[l.status] || l.status;
        var cls = statusCls[l.status] || 'status-pending';
        return '<div class="my-listing" onclick="window.location.href=\'/oglas/'+esc(l.id)+'\'">' +
          '<div class="my-listing-body">' +
            '<div class="my-listing-title">'+esc(l.title)+'</div>' +
            '<div class="my-listing-sub">⇄ '+esc(l.wantedFor||'Otvoreno')+'</div>' +
          '</div>' +
          '<span class="status-badge '+cls+'">'+esc(label)+'</span>' +
          '</div>';
      }).join('');
    })
    .catch(function(err) {
      document.getElementById('my-listings').innerHTML = '<div class="empty"><div class="empty-icon">⚠️</div><div>Greška pri učitavanju</div></div>';
    });
});
`));
});

export default router;
