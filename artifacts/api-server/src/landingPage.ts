export function landingPageHtml(): string {
  return `<!DOCTYPE html>
<html lang="hr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Trampaj.hr — Trampa bez novca</title>
  <meta name="description" content="Ponudi predmete koje više ne trebaš i zamijeni ih za nešto što zaista trebaš. Trampa bez novca, direktno između ljudi." />
  <meta property="og:title" content="Trampaj.hr — Trampa bez novca" />
  <meta property="og:description" content="Ponudi predmete koje više ne trebaš i zamijeni ih za nešto što zaista trebaš." />
  <meta property="og:type" content="website" />
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    :root {
      --navy: #08152E;
      --navy2: #0c1d3d;
      --yellow: #F5C100;
      --blue: #38BDF8;
      --text: #F0F4FF;
      --muted: #7A90B0;
    }
    html, body {
      min-height: 100%;
      background: var(--navy);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
    }

    /* ── NAV ── */
    nav {
      position: fixed; top: 0; left: 0; right: 0; z-index: 50;
      display: flex; align-items: center; justify-content: space-between;
      padding: 0 24px; height: 60px;
      background: rgba(8,21,46,.85); backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(255,255,255,.07);
    }
    .logo { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 1.15rem; }
    .logo-icon {
      width: 36px; height: 36px; border-radius: 10px;
      background: var(--yellow); display: flex; align-items: center; justify-content: center;
    }
    .logo span { color: var(--text); }
    .logo span b { color: var(--yellow); }
    .nav-cta {
      padding: 8px 18px; border-radius: 10px; font-weight: 700; font-size: .85rem;
      background: var(--yellow); color: var(--navy); text-decoration: none; transition: .15s;
    }
    .nav-cta:hover { background: #ffd426; transform: translateY(-1px); }

    /* ── HERO ── */
    .hero {
      min-height: 100svh;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 100px 24px 60px;
      text-align: center;
      background:
        radial-gradient(ellipse 80% 60% at 50% -10%, rgba(245,193,0,.13) 0%, transparent 70%),
        radial-gradient(ellipse 60% 40% at 80% 80%, rgba(56,189,248,.07) 0%, transparent 60%),
        var(--navy);
    }
    .badge {
      display: inline-flex; align-items: center; gap: 7px;
      padding: 6px 14px; border-radius: 20px;
      background: rgba(245,193,0,.12); border: 1px solid rgba(245,193,0,.25);
      font-size: .78rem; font-weight: 700; color: var(--yellow);
      text-transform: uppercase; letter-spacing: .06em;
      margin-bottom: 28px;
    }
    .badge-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--yellow); animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }

    h1 {
      font-size: clamp(2.4rem, 7vw, 4.2rem);
      font-weight: 900; line-height: 1.1; letter-spacing: -.02em;
      max-width: 720px; margin-bottom: 22px;
    }
    h1 em { font-style: normal; color: var(--yellow); }
    .subtitle {
      font-size: clamp(1rem, 2.5vw, 1.2rem); color: var(--muted);
      max-width: 500px; line-height: 1.65; margin-bottom: 44px;
    }

    .cta-group { display: flex; gap: 14px; flex-wrap: wrap; justify-content: center; margin-bottom: 56px; }
    .btn-primary {
      display: inline-flex; align-items: center; gap: 10px;
      padding: 15px 28px; border-radius: 14px; font-weight: 800; font-size: 1rem;
      background: var(--yellow); color: var(--navy); text-decoration: none;
      box-shadow: 0 4px 24px rgba(245,193,0,.3); transition: .2s;
    }
    .btn-primary:hover { background: #ffd426; transform: translateY(-2px); box-shadow: 0 8px 32px rgba(245,193,0,.4); }
    .btn-secondary {
      display: inline-flex; align-items: center; gap: 10px;
      padding: 15px 28px; border-radius: 14px; font-weight: 700; font-size: 1rem;
      background: rgba(255,255,255,.06); color: var(--text); text-decoration: none;
      border: 1px solid rgba(255,255,255,.12); transition: .2s;
    }
    .btn-secondary:hover { background: rgba(255,255,255,.1); transform: translateY(-2px); }

    /* store badges */
    .store-group { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
    .store-badge {
      display: inline-flex; align-items: center; gap: 9px;
      padding: 10px 18px; border-radius: 12px;
      background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);
      text-decoration: none; color: var(--text); transition: .2s;
    }
    .store-badge:hover { background: rgba(255,255,255,.09); border-color: rgba(255,255,255,.2); }
    .store-badge svg { flex-shrink: 0; }
    .store-badge-text { text-align: left; }
    .store-badge-text small { display: block; font-size: .65rem; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
    .store-badge-text strong { font-size: .95rem; font-weight: 700; }

    /* ── HOW IT WORKS ── */
    .section { padding: 80px 24px; }
    .section-inner { max-width: 900px; margin: 0 auto; }
    .section-label { font-size: .75rem; font-weight: 700; letter-spacing: .1em; color: var(--blue); text-transform: uppercase; margin-bottom: 14px; }
    .section-title { font-size: clamp(1.7rem, 4vw, 2.5rem); font-weight: 800; margin-bottom: 48px; }

    .steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 20px; }
    .step {
      padding: 28px 24px; border-radius: 18px;
      background: rgba(255,255,255,.04); border: 1px solid rgba(255,255,255,.08);
      transition: .2s;
    }
    .step:hover { background: rgba(255,255,255,.07); border-color: rgba(255,255,255,.15); transform: translateY(-3px); }
    .step-num {
      width: 44px; height: 44px; border-radius: 12px;
      background: rgba(245,193,0,.15); color: var(--yellow);
      display: flex; align-items: center; justify-content: center;
      font-weight: 900; font-size: 1.1rem; margin-bottom: 16px;
    }
    .step h3 { font-size: 1rem; font-weight: 700; margin-bottom: 8px; }
    .step p { font-size: .87rem; color: var(--muted); line-height: 1.6; }

    /* ── FEATURES ── */
    .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
    .feature {
      padding: 22px 20px; border-radius: 14px;
      background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07);
    }
    .feature-icon { font-size: 1.8rem; margin-bottom: 12px; }
    .feature h4 { font-size: .92rem; font-weight: 700; margin-bottom: 6px; }
    .feature p { font-size: .82rem; color: var(--muted); line-height: 1.55; }

    /* ── CTA BANNER ── */
    .cta-banner {
      margin: 0 24px 80px; border-radius: 24px;
      padding: 56px 32px; text-align: center;
      background: linear-gradient(135deg, rgba(245,193,0,.12) 0%, rgba(56,189,248,.08) 100%);
      border: 1px solid rgba(245,193,0,.2);
    }
    .cta-banner h2 { font-size: clamp(1.5rem, 4vw, 2.2rem); font-weight: 800; margin-bottom: 14px; }
    .cta-banner p { color: var(--muted); font-size: 1rem; margin-bottom: 32px; max-width: 420px; margin-left: auto; margin-right: auto; }

    /* ── FOOTER ── */
    footer {
      border-top: 1px solid rgba(255,255,255,.07);
      padding: 28px 24px; text-align: center;
      font-size: .8rem; color: var(--muted);
    }
    footer a { color: var(--muted); text-decoration: underline; margin: 0 8px; }

    @media (max-width: 480px) {
      .nav-cta { display: none; }
      .btn-primary, .btn-secondary { width: 100%; justify-content: center; }
      .cta-group { flex-direction: column; }
    }
  </style>
</head>
<body>

<nav>
  <div class="logo">
    <div class="logo-icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M4 8h16M4 8l4-4M4 8l4 4M20 16H4M20 16l-4-4M20 16l-4 4" stroke="#08152E" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>
    <span>Trampaj<b>.hr</b></span>
  </div>
  <a href="#preuzmi" class="nav-cta">Preuzmi app</a>
</nav>

<section class="hero">
  <div class="badge">
    <span class="badge-dot"></span>
    Uskoro dostupno · Prijavi se za early access
  </div>

  <h1>Trampa bez novca,<br/><em>direktno između ljudi</em></h1>

  <p class="subtitle">
    Ponudi predmete koje više ne trebaš i zamijeni ih za nešto što zaista trebaš.
    Bez plaćanja, bez posrednika — samo trampa.
  </p>

  <div class="cta-group">
    <a href="/mobile" class="btn-primary">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" stroke="currentColor" stroke-width="2"/><path d="M12 17h.01" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>
      Testiraj aplikaciju
    </a>
    <a href="#kako" class="btn-secondary">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M12 8v4l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
      Kako funkcionira?
    </a>
  </div>

  <div class="store-group" id="preuzmi">
    <a href="#" class="store-badge">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.42.07 2.4.77 3.23.8 1.22-.25 2.4-.99 3.7-.84 1.57.19 2.75.86 3.52 2.16-3.27 1.96-2.79 6.15.53 7.36-.6 1.43-1.43 2.84-2.98 4.4zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
      <div class="store-badge-text">
        <small>Preuzmi na</small>
        <strong>App Store</strong>
      </div>
    </a>
    <a href="#" class="store-badge">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M3.18 23.76c.3.17.64.22.98.14l12.2-7.05-2.77-2.77L3.18 23.76z" fill="#EA4335"/>
        <path d="M20.82 10.31A1.83 1.83 0 0 0 20 8.73L17.57 7.3l-3.07 3.07 3.07 3.07 2.45-1.43c.52-.3.82-.84.8-1.7z" fill="#FBBC04"/>
        <path d="M3.18.24A1.94 1.94 0 0 0 3 1.1v21.8c0 .3.06.58.18.82l.08.08L13.62 13.4v-.2L3.26.16l-.08.08z" fill="#4285F4"/>
        <path d="M13.62 12 16.4 9.22 4.16.16C3.8-.07 3.37-.05 3.02.13L13.62 12z" fill="#34A853"/>
      </svg>
      <div class="store-badge-text">
        <small>Dostupno na</small>
        <strong>Google Play</strong>
      </div>
    </a>
  </div>
</section>

<section class="section" id="kako">
  <div class="section-inner">
    <div class="section-label">Kako funkcionira</div>
    <h2 class="section-title">Tri koraka do trampe</h2>
    <div class="steps">
      <div class="step">
        <div class="step-num">1</div>
        <h3>Objavi predmet</h3>
        <p>Fotografiraj što nudiš i opiši što tražiš u zamjenu. Objava traje manje od minute.</p>
      </div>
      <div class="step">
        <div class="step-num">2</div>
        <h3>Pronađi match</h3>
        <p>Pregledaj tisuće ponuda ili čekaj da netko ponudi trampu za tvoj oglas.</p>
      </div>
      <div class="step">
        <div class="step-num">3</div>
        <h3>Dogovori i trampi</h3>
        <p>Chattaj, dogovorite preuzimanje ili dostavu — i uživaj u novoj stvari bez da si potrošio ni kune.</p>
      </div>
    </div>
  </div>
</section>

<section class="section" style="padding-top:0">
  <div class="section-inner">
    <div class="section-label">Zašto Trampaj</div>
    <h2 class="section-title">Trampa kakva treba biti</h2>
    <div class="features-grid">
      <div class="feature">
        <div class="feature-icon">🔒</div>
        <h4>Sigurna trampa</h4>
        <p>Escrow sustav drži predmete u sigurnoj ruci dok obje strane ne potvrde razmjenu.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">📦</div>
        <h4>Dostava na klik</h4>
        <p>Plati kurirsku dostavu direktno u appu. Nalepnica stiže na mail.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">⚡</div>
        <h4>Instant chat</h4>
        <p>Razgovaraj, pregovaraj i dogovori trampu unutar aplikacije.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">🇭🇷</div>
        <h4>Made in Croatia</h4>
        <p>Servis namjenjen hrvatskim korisnicima, s podrškom na hrvatskom jeziku.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">0 kn</div>
        <h4>Besplatno</h4>
        <p>Objava oglasa i trampa su potpuno besplatni. Bez skrivenih naknada.</p>
      </div>
      <div class="feature">
        <div class="feature-icon">🤖</div>
        <h4>AI moderacija</h4>
        <p>Automatska provjera oglasa osigurava da vidite samo stvarne i relevantne ponude.</p>
      </div>
    </div>
  </div>
</section>

<div class="cta-banner">
  <h2>Spreman za prvu trampu?</h2>
  <p>Preuzmi aplikaciju i objavi svoj prvi oglas — potpuno besplatno.</p>
  <div class="store-group" style="justify-content:center">
    <a href="#preuzmi" class="btn-primary" style="font-size:.95rem;padding:13px 26px">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 16l-4-4h8l-4 4zM12 3v9" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 20h18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>
      Preuzmi Trampaj
    </a>
  </div>
</div>

<footer>
  <p>&copy; 2025 Trampaj.hr &nbsp;·&nbsp;
    <a href="/privacy">Privatnost</a>
    <a href="/terms">Uvjeti</a>
  </p>
</footer>

</body>
</html>`;
}
