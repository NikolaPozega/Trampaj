import React from "react";
import { Router, Switch, Route } from "wouter";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";

const NEON_FRAME_CSS = `
@property --neon-angle {
  syntax: '<angle>';
  initial-value: 0deg;
  inherits: false;
}
.neon-screen-frame {
  position: fixed;
  top: env(safe-area-inset-top, 0px);
  left: env(safe-area-inset-left, 0px);
  right: env(safe-area-inset-right, 0px);
  bottom: env(safe-area-inset-bottom, 0px);
  pointer-events: none;
  z-index: 10;
}
.neon-screen-frame.neon-static {
  border: 2px solid transparent;
  border-image: linear-gradient(135deg,
    rgba(0,200,255,0.85) 0%,
    rgba(0,200,255,0.28) 30%,
    rgba(20,40,80,0.05) 50%,
    rgba(245,193,0,0.28) 70%,
    rgba(245,193,0,0.85) 100%
  ) 1;
  box-shadow:
    inset 6px 6px 40px -15px rgba(0,200,255,0.22),
    inset -6px -6px 40px -15px rgba(245,193,0,0.18);
}
.neon-screen-frame.neon-spin {
  border: 3px solid transparent;
  border-image: conic-gradient(from var(--neon-angle),
    #00C8FF 0deg,
    #88EEFF 8deg,
    #ffffff 14deg,
    #FFE566 20deg,
    #F5C100 30deg,
    #F5C100 170deg,
    #00C8FF 180deg,
    #88EEFF 188deg,
    #ffffff 194deg,
    #FFE566 200deg,
    #F5C100 210deg,
    #F5C100 350deg,
    #00C8FF 360deg
  ) 1;
  animation: neon-frame-spin 2.5s linear 2;
}
@keyframes neon-frame-spin {
  to { --neon-angle: 360deg; }
}
`;

function NeonScreenFrame() {
  const [phase, setPhase] = React.useState<"spin" | "static" | "">("");

  React.useEffect(() => {
    const shown = localStorage.getItem("neon_frame_v1");
    setPhase(shown ? "static" : "spin");
  }, []);

  return (
    <>
      <style>{NEON_FRAME_CSS}</style>
      <div
        className={`neon-screen-frame${phase ? ` neon-${phase}` : ""}`}
        onAnimationEnd={() => {
          localStorage.setItem("neon_frame_v1", "1");
          setPhase("static");
        }}
      />
    </>
  );
}

// ─── Shared legal styles ──────────────────────────────────────────────────────
const LEGAL_CSS = `
  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
  :root { --navy: #08152E; --yellow: #F5C100; --text: #F0F4FF; --muted: #7A90B0; }
  html, body { min-height: 100%; background: var(--navy); color: var(--text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
    -webkit-font-smoothing: antialiased; }
  .legal-wrap { max-width: 720px; margin: 0 auto; padding: 40px 24px 80px; }
  .legal-back { display:inline-flex; align-items:center; gap:6px; color:var(--muted);
    text-decoration:none; font-size:.85rem; margin-bottom:28px; transition:color .2s; }
  .legal-back:hover { color:var(--text); }
  .legal-logo { font-size:1.1rem; font-weight:900; color:var(--yellow); margin-bottom:4px; }
  .legal-title { font-size:1.6rem; font-weight:800; margin-bottom:6px; }
  .legal-updated { font-size:.8rem; color:var(--muted); margin-bottom:28px; }
  .legal-badge { display:flex; align-items:flex-start; gap:10px; padding:12px 16px;
    border-radius:10px; margin-bottom:28px; font-size:.82rem; line-height:1.6; }
  .legal-badge.yellow { background:rgba(245,193,0,.08); border:1px solid rgba(245,193,0,.22); color:#c8a800; }
  .legal-badge.blue { background:rgba(56,189,248,.08); border:1px solid rgba(56,189,248,.22); color:#38BDF8; }
  .legal-section { margin-bottom:28px; }
  .legal-section h2 { font-size:.95rem; font-weight:700; margin-bottom:10px; color:var(--text); }
  .legal-section p { font-size:.87rem; line-height:1.75; color:var(--muted); white-space:pre-line; }
  .legal-contact { display:flex; align-items:center; gap:14px; padding:16px;
    background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.08);
    border-radius:12px; margin-top:32px; }
  .legal-contact-title { font-size:.85rem; font-weight:600; margin-bottom:3px; }
  .legal-contact-email { font-size:.85rem; color:var(--yellow); text-decoration:none; }
  .legal-contact-email:hover { text-decoration:underline; }
`;

function TermsPage() {
  return (
    <>
      <style>{LEGAL_CSS}</style>
      <div className="legal-wrap">
        <a href={BASE + "/"} className="legal-back">← Natrag na Trampaj.hr</a>
        <div className="legal-logo">Trampaj.hr</div>
        <h1 className="legal-title">Uvjeti korištenja</h1>
        <p className="legal-updated">Zadnja izmjena: 3. lipnja 2026. &nbsp;·&nbsp; Operator: Diplomat d.o.o., Dr. F. Tuđmana 10, 34000 Požega | OIB: 77718954672</p>

        <div className="legal-badge yellow">📄 Korištenjem Trampaj.hr platforme prihvaćate ove Uvjete korištenja u cijelosti.</div>

        {[
          ["1. Operator i opis usluge", "Operator platforme:\nDiplomat d.o.o., Dr. F. Tuđmana 10, 34000 Požega | OIB: 77718954672\n\nTrampaj.hr je platforma koja omogućuje razmjenu (trampu) predmeta između fizičkih osoba. Platforma isključivo posreduje u spajanju korisnika — ne sudjeluje u transakcijama, ne preuzima odgovornost za predmete niti jamči uspješnu zamjenu.\n\nKorištenjem platforme potvrđujete da ste punoljetna osoba (18+) s pravnom sposobnošću za sklapanje ugovora."],
          ["2. Registracija i korisnički račun", "• Registracija je besplatna i dobrovoljna\n• Korisnik je odgovoran za točnost unesenih podataka\n• Zabranjeno je kreirati lažne profile ili se predstavljati tuđim identitetom\n• Jedan korisnik smije imati samo jedan aktivan račun\n• Korisnik je dužan čuvati povjerljivost lozinke i odmah prijaviti svaki neovlašteni pristup\n• Platforma zadržava pravo suspendiranja ili brisanja računa koji krši ove Uvjete"],
          ["3. Pravila oglašavanja", "Oglasi moraju biti točni, potpuni i u skladu s ovim pravilima. Zabranjeno je objavljivati:\n\n• Lažne ili obmanjujuće oglase\n• Predmete koji su predmet krađe, falsifikati ili ilegalna roba\n• Oružje, eksplozivi, droge i kontrolirane supstancije\n• Živežne namirnice i lijekovi koji zahtijevaju posebne uvjete pohrane\n• Sadržaj koji vrijeđa dostojanstvo osoba ili potiče mržnju\n• Predmete koji su zakonom zabranjeni za promet\n• Živa bića (životinje)\n\nKorisnik je osobno odgovoran za točnost i zakonitost objavljenih oglasa."],
          ["4. Zabranjena ponašanja", "Zabranjeno je:\n\n• Kontaktirati korisnike s ciljem prijevare ili izvlačenja novca\n• Manipulirati ocjenama (lažne recenzije, samooklenjivanje)\n• Koristiti automatizirane alate za masovno objavljivanje oglasa (spam)\n• Prikupljati osobne podatke ostalih korisnika bez njihovog pristanka\n• Koristiti platformu za oglašavanje komercijalnih usluga ili reklama\n• Zaobilaziti mjere sigurnosti platforme"],
          ["5. Zamjena predmeta i odgovornost", "Trampaj.hr posreduje u spajanju korisnika, ali:\n\n• NE garantira kvalitetu, stanje ili autentičnost predmeta\n• NE sudjeluje u fizičkoj razmjeni predmeta\n• NIJE odgovorna za štete nastale uslijed zamjene\n• NE pruža usluge prijevoza niti jamči dostavu\n\nKorisnici su sami odgovorni za dogovaranje uvjeta zamjene, provjeru predmeta i odabir sigurnog načina razmjene."],
          ["6. Dostava i plaćanje dostave", "Platforma ne naplaćuje proviziju niti posreduje u financijskim transakcijama.\n\nUkoliko korisnici dogovore kurirsku dostavu:\n• Svaki korisnik plaća dostavu paketa koji prima\n• Trošak i organizacija dostave isključivo su dogovor između korisnika\n• Platforma ne snosi odgovornost za izgubljene, oštećene ili zakasnjele pošiljke"],
          ["7. DSA — Digitalni tržišni akti (Uredba EU 2022/2065)", "Trampaj.hr posluje sukladno Zakonu o provedbi Uredbe EU o digitalnim uslugama (NN, 28.3.2025.):\n\n• Korisnici mogu prijaviti ilegalne ili sumnjive oglase putem gumba \"Prijavi oglas\"\n• Prijave se obrađuju unutar 72 sata\n• Platforma poduzima mjere uklanjanja nezakonitog sadržaja\n• Kontakt za tijela javne vlasti: pravna@trampaj.hr"],
          ["8. Status korisnika — privatne osobe", "Sukladno čl. 68. Zakona o zaštiti potrošača (NN 19/22, 59/23), Trampaj.hr je internetsko tržište koje isključivo spaja privatne osobe.\n\nSvi korisnici platforme su privatne osobe — nisu trgovci u smislu potrošačkog zakonodavstva EU-a. Stoga:\n\n• Zakonska jamstva i prava potrošača propisana EU direktivama ne primjenjuju se na zamjene ostvarene putem ove platforme\n• Svaki oglas na platformi automatski je označen kao ponuda privatne osobe\n\nAko korisnik u stvarnosti posluje kao trgovac, dužan je to naznačiti i preuzima punu zakonsku odgovornost prema potrošačima."],
          ["9. Intelektualno vlasništvo", "Korisnik zadržava autorska prava na fotografije i opise koje objavljuje. Objavljivanjem sadržaja dajete Trampaj.hr neekskluzivnu, besplatnu licencu za prikaz tog sadržaja unutar platforme.\n\nLogo, dizajn i naziv \"Trampaj.hr\" vlasništvo su operatora platforme i ne smiju se koristiti bez pismenog odobrenja."],
          ["10. Ograničenje odgovornosti", "Platforma se pruža \"kakva jest\" bez jamstava dostupnosti ili prikladnosti. Operator ne odgovara za:\n\n• Izravne ili neizravne štete nastale korištenjem platforme\n• Gubitak podataka, prihoda ili poslovnih mogućnosti\n• Ponašanje ili propuste trećih osoba (korisnika, kurirskih službi)\n\nUkupna odgovornost operatora ograničena je na iznos koji je korisnik platio za korištenje usluge (usluga je besplatna)."],
          ["11. Rješavanje sporova i prigovori", "Za pritužbe na rad platforme pišite na: pravna@trampaj.hr\nOperator je dužan odgovoriti u roku od 15 dana od zaprimanja prigovora (čl. 10. ZZP, NN 19/22).\n\nNa ugovorne odnose primjenjuje se hrvatsko pravo. Nadležni sud je u Požegi.\n\nPotrošači imaju pravo koristiti platformu EU za mrežno rješavanje sporova:\nhttps://ec.europa.eu/consumers/odr\n\nIzvansudsko rješavanje sporova: Centar za mirenje pri HGK (www.hgk.hr/centar-za-mirenje)."],
          ["12. Izmjene uvjeta", "Uvjete možemo ažurirati. O bitnim izmjenama obavijestit ćemo vas unutar aplikacije ili e-mailom najmanje 30 dana unaprijed."],
        ].map(([title, body]) => (
          <div key={title} className="legal-section">
            <h2>{title}</h2>
            <p>{body}</p>
          </div>
        ))}

        <div className="legal-contact">
          <span style={{fontSize:"1.3rem"}}>✉️</span>
          <div>
            <div className="legal-contact-title">Kontakt</div>
            <a href="mailto:pravna@trampaj.hr" className="legal-contact-email">pravna@trampaj.hr</a>
          </div>
        </div>
      </div>
    </>
  );
}

function PrivacyPage() {
  return (
    <>
      <style>{LEGAL_CSS}</style>
      <div className="legal-wrap">
        <a href={BASE + "/"} className="legal-back">← Natrag na Trampaj.hr</a>
        <div className="legal-logo">Trampaj.hr</div>
        <h1 className="legal-title">Politika privatnosti</h1>
        <p className="legal-updated">Zadnja izmjena: 3. lipnja 2026.</p>

        <div className="legal-badge blue">🛡️ Sukladno Uredbi EU 2016/679 (GDPR) i Zakonu o provedbi Opće uredbe (NN 42/2018)</div>

        {[
          ["1. Voditelj obrade podataka", "Diplomat d.o.o.\nDr. F. Tuđmana 10, 34000 Požega\nOIB: 77718954672\n\nKontakt za zaštitu podataka: gdpr@trampaj.hr\n\nNadzorno tijelo: AZOP, Martićeva 14, Zagreb — www.azop.hr"],
          ["2. Koje osobne podatke prikupljamo", "• Korisničko ime i e-mail adresa (pri registraciji)\n• Lozinka (pohranjena isključivo kriptirana — bcrypt)\n• Broj mobitela (opcionalno — vidljiv samo u oglasima gdje ga sami objavite)\n• Adresa / lokacija (opcionalno)\n• Profilna fotografija (opcionalno)\n• Slike predmeta u oglasima\n• Chat poruke između korisnika\n• Aktivnost: objavljeni oglasi, ocjene, status zamjena"],
          ["3. Svrha i pravna osnova obrade", "• Izvršenje ugovora (čl. 6/1/b GDPR) — pružanje usluge trampe\n• Legitimni interes (čl. 6/1/f GDPR) — zaštita od prijevare i zlouporabe\n• Privola (čl. 6/1/a GDPR) — marketinške komunikacije (samo uz privolu)\n• Pravna obveza (čl. 6/1/c GDPR) — ispunjenje zakonskih zahtjeva\n\nPodaci se NE koriste za profiliranje niti izravni marketing bez vaše izričite privole."],
          ["4. Pohrana i sigurnost", "Podaci se pohranjuju na sigurnim poslužiteljima unutar EU. Primjenjujemo:\n\n• Enkripcija lozinki (bcrypt)\n• HTTPS/TLS za svu komunikaciju\n• Ograničen pristup — samo autorizirano osoblje\n• Nadzor tehničkih grešaka (Sentry, EU datacenter)\n\nU slučaju povrede osobnih podataka obavijestit ćemo vas i AZOP u roku od 72 sata (čl. 33. GDPR)."],
          ["5. Primatelji podataka (izvršitelji obrade)", "Radi pružanja usluge, dijelimo minimalne potrebne podatke s:\n\n• Stripe Inc. — obrada kartičnih plaćanja pri kurirskoj dostavi (EU standardne ugovorne klauzule)\n• Google Firebase / FCM — slanje push obavijesti (samo token uređaja)\n• Sentry (EU datacenter) — praćenje tehničkih grešaka; anonimizirana dijagnostika\n• Expo / EAS — distribucija mobilne aplikacije; ne prima osobne podatke korisnika\n• GLS / Box Now — kurirske službe; primaju adresu dostave samo ako odaberete kurirsku dostavu\n\nSve treće strane vezane su ugovorom o obradi podataka (DPA). Podaci se ne prodaju."],
          ["6. Vaša prava (GDPR)", "• Pravo na pristup — zatražite uvid u sve vaše podatke\n• Pravo na ispravak — ispravite podatke u postavkama profila\n• Pravo na brisanje — \"Izbriši račun\" u profilu briše sve podatke unutar 30 dana\n• Pravo na prenosivost — zatražite izvoz podataka u JSON formatu\n• Pravo na ograničenje obrade\n• Pravo na prigovor\n• Pravo na opoziv privole — u svakom trenutku bez posljedica\n\nZa zahtjeve: gdpr@trampaj.hr (odgovaramo u roku od 30 dana, čl. 12. GDPR)."],
          ["7. Rokovi pohrane", "• Osobni podaci čuvaju se dok je račun aktivan\n• Nakon brisanja računa — podaci se brišu unutar 30 dana\n• Objavljeni oglasi anonimiziraju se\n• Log podaci za sigurnost čuvaju se do 12 mjeseci\n• Neaktivni oglasi arhiviraju se nakon 90 dana"],
          ["8. Maloljetnici", "Platforma nije namijenjena osobama mlađim od 18 godina. Korištenjem potvrđujete punoljetnost. Ako saznamo da je maloljetna osoba koristila platformu, odmah ćemo obrisati njene podatke."],
          ["9. Kolačići i analitika", "Web stranica koristi samo tehničke kolačiće neophodne za rad. Mobilna aplikacija ne koristi kolačiće. Ako budemo uveli analitiku, zatražit ćemo vašu privolu unaprijed."],
          ["10. Prigovori — AZOP", "Ako smatrate da obrađujemo vaše podatke protivno GDPR-u:\n\nAgencija za zaštitu osobnih podataka (AZOP)\nMartićeva ulica 14, 10 000 Zagreb\nwww.azop.hr | azop@azop.hr"],
          ["11. Izmjene politike", "O značajnim izmjenama obavijestit ćemo vas unutar aplikacije ili e-mailom najmanje 30 dana unaprijed."],
        ].map(([title, body]) => (
          <div key={title} className="legal-section">
            <h2>{title}</h2>
            <p>{body}</p>
          </div>
        ))}

        <div className="legal-contact">
          <span style={{fontSize:"1.3rem"}}>🛡️</span>
          <div>
            <div className="legal-contact-title">Kontakt za zaštitu podataka</div>
            <a href="mailto:gdpr@trampaj.hr" className="legal-contact-email">gdpr@trampaj.hr</a>
          </div>
        </div>
      </div>
    </>
  );
}

function LandingPage() {
  return (
    <>
      <style>{`
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
        .logo span b { color: var(--yellow); }
        .nav-cta {
          padding: 8px 18px; border-radius: 10px; font-weight: 700; font-size: .85rem;
          background: var(--yellow); color: var(--navy); text-decoration: none; transition: .15s;
        }
        .nav-cta:hover { background: #ffd426; transform: translateY(-1px); }
        .hero {
          min-height: 100svh;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 100px 24px 60px; text-align: center;
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
          text-transform: uppercase; letter-spacing: .06em; margin-bottom: 28px;
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
        .store-group { display: flex; gap: 12px; flex-wrap: wrap; justify-content: center; }
        .store-badge {
          display: inline-flex; align-items: center; gap: 9px;
          padding: 10px 18px; border-radius: 12px;
          background: rgba(255,255,255,.05); border: 1px solid rgba(255,255,255,.1);
          text-decoration: none; color: var(--text); transition: .2s;
        }
        .store-badge:hover { background: rgba(255,255,255,.09); border-color: rgba(255,255,255,.2); }
        .store-badge-text { text-align: left; }
        .store-badge-text small { display: block; font-size: .65rem; color: var(--muted); text-transform: uppercase; letter-spacing: .05em; }
        .store-badge-text strong { font-size: .95rem; font-weight: 700; }
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
        .features-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
        .feature {
          padding: 22px 20px; border-radius: 14px;
          background: rgba(255,255,255,.03); border: 1px solid rgba(255,255,255,.07);
        }
        .feature-icon { font-size: 1.8rem; margin-bottom: 12px; }
        .feature h4 { font-size: .92rem; font-weight: 700; margin-bottom: 6px; }
        .feature p { font-size: .82rem; color: var(--muted); line-height: 1.55; }
        .cta-banner {
          margin: 0 24px 80px; border-radius: 24px;
          padding: 56px 32px; text-align: center;
          background: linear-gradient(135deg, rgba(245,193,0,.12) 0%, rgba(56,189,248,.08) 100%);
          border: 1px solid rgba(245,193,0,.2);
        }
        .cta-banner h2 { font-size: clamp(1.5rem, 4vw, 2.2rem); font-weight: 800; margin-bottom: 14px; }
        .cta-banner p { color: var(--muted); font-size: 1rem; margin-bottom: 32px; max-width: 420px; margin-left: auto; margin-right: auto; }
        footer {
          border-top: 1px solid rgba(255,255,255,.07);
          padding: 32px 24px; text-align: center;
          font-size: .8rem; color: var(--muted);
        }
        footer a { color: var(--muted); text-decoration: underline; margin: 0 8px; }
        .odr-notice {
          margin-bottom: 16px;
          padding: 12px 20px;
          background: rgba(245,193,0,.07);
          border: 1px solid rgba(245,193,0,.18);
          border-radius: 10px;
          max-width: 560px;
          margin-left: auto;
          margin-right: auto;
          font-size: .78rem;
          line-height: 1.6;
          color: #9aadcc;
        }
        .odr-notice a { color: var(--yellow); margin: 0 2px; }
        @media (max-width: 480px) {
          .nav-cta { display: none; }
          .btn-primary, .btn-secondary { width: 100%; justify-content: center; }
          .cta-group { flex-direction: column; }
        }
      `}</style>

      <nav>
        <div className="logo">
          <div className="logo-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M4 8h16M4 8l4-4M4 8l4 4M20 16H4M20 16l-4-4M20 16l-4 4" stroke="#08152E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span>Trampaj<b>.hr</b></span>
        </div>
        <a href="#preuzmi" className="nav-cta">Preuzmi app</a>
      </nav>

      <section className="hero">
        <div className="badge">
          <span className="badge-dot"></span>
          Uskoro dostupno · Prijavi se za early access
        </div>
        <h1>Trampa bez novca,<br/><em>direktno između ljudi</em></h1>
        <p className="subtitle">
          Ponudi predmete koje više ne trebaš i zamijeni ih za nešto što zaista trebaš.
          Bez plaćanja, bez posrednika — samo trampa.
        </p>
        <div className="cta-group">
          <a href="#preuzmi" className="btn-primary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 16l-4-4h8l-4 4zM12 3v9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 20h18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
            Preuzmi aplikaciju
          </a>
          <a href="#kako" className="btn-secondary">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/><path d="M12 8v4l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            Kako funkcionira?
          </a>
        </div>
        <div className="store-group" id="preuzmi">
          <a href="#" className="store-badge">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.7 9.05 7.4c1.42.07 2.4.77 3.23.8 1.22-.25 2.4-.99 3.7-.84 1.57.19 2.75.86 3.52 2.16-3.27 1.96-2.79 6.15.53 7.36-.6 1.43-1.43 2.84-2.98 4.4zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
            <div className="store-badge-text">
              <small>Preuzmi na</small>
              <strong>App Store</strong>
            </div>
          </a>
          <a href="#" className="store-badge">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M3.18 23.76c.3.17.64.22.98.14l12.2-7.05-2.77-2.77L3.18 23.76z" fill="#EA4335"/>
              <path d="M20.82 10.31A1.83 1.83 0 0 0 20 8.73L17.57 7.3l-3.07 3.07 3.07 3.07 2.45-1.43c.52-.3.82-.84.8-1.7z" fill="#FBBC04"/>
              <path d="M3.18.24A1.94 1.94 0 0 0 3 1.1v21.8c0 .3.06.58.18.82l.08.08L13.62 13.4v-.2L3.26.16l-.08.08z" fill="#4285F4"/>
              <path d="M13.62 12 16.4 9.22 4.16.16C3.8-.07 3.37-.05 3.02.13L13.62 12z" fill="#34A853"/>
            </svg>
            <div className="store-badge-text">
              <small>Dostupno na</small>
              <strong>Google Play</strong>
            </div>
          </a>
        </div>
      </section>

      <section className="section" id="kako">
        <div className="section-inner">
          <div className="section-label">Kako funkcionira</div>
          <h2 className="section-title">Tri koraka do trampe</h2>
          <div className="steps">
            <div className="step">
              <div className="step-num">1</div>
              <h3>Objavi predmet</h3>
              <p>Fotografiraj što nudiš i opiši što tražiš u zamjenu. Objava traje manje od minute.</p>
            </div>
            <div className="step">
              <div className="step-num">2</div>
              <h3>Pronađi match</h3>
              <p>Pregledaj tisuće ponuda ili čekaj da netko ponudi trampu za tvoj oglas.</p>
            </div>
            <div className="step">
              <div className="step-num">3</div>
              <h3>Dogovori i trampi</h3>
              <p>Chattaj, dogovorite preuzimanje ili dostavu — i uživaj u novoj stvari bez da si potrošio ni kune.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section" style={{paddingTop: 0}}>
        <div className="section-inner">
          <div className="section-label">Zašto Trampaj</div>
          <h2 className="section-title">Trampa kakva treba biti</h2>
          <div className="features-grid">
            {[
              {icon:"🔒", title:"Sigurna trampa", desc:"Sustav drži predmete u sigurnoj ruci dok obje strane ne potvrde razmjenu."},
              {icon:"📦", title:"Dostava na klik", desc:"Plati kurirsku dostavu direktno u appu. Nalepnica stiže na mail."},
              {icon:"⚡", title:"Instant chat", desc:"Razgovaraj, pregovaraj i dogovori trampu unutar aplikacije."},
              {icon:"🇭🇷", title:"Made in Croatia", desc:"Servis namijenjen hrvatskim korisnicima, s podrškom na hrvatskom jeziku."},
              {icon:"0 kn", title:"Besplatno", desc:"Objava oglasa i trampa su potpuno besplatni. Bez skrivenih naknada."},
              {icon:"🤖", title:"AI moderacija", desc:"Automatska provjera oglasa osigurava da vidite samo stvarne i relevantne ponude."},
            ].map((f) => (
              <div key={f.title} className="feature">
                <div className="feature-icon">{f.icon}</div>
                <h4>{f.title}</h4>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="cta-banner">
        <h2>Spreman za prvu trampu?</h2>
        <p>Preuzmi aplikaciju i objavi svoj prvi oglas — potpuno besplatno.</p>
        <div className="store-group" style={{justifyContent:"center"}}>
          <a href="#preuzmi" className="btn-primary" style={{fontSize:".95rem", padding:"13px 26px"}}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 16l-4-4h8l-4 4zM12 3v9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/><path d="M3 20h18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/></svg>
            Preuzmi Trampaj
          </a>
        </div>
      </div>

      <footer>
        <div className="odr-notice">
          <strong style={{color:"#c8a800"}}>Rješavanje potrošačkih sporova</strong><br />
          Sukladno čl. 10. Zakona o zaštiti potrošača (NN 19/22, 59/23) i Uredbi EU 524/2013, obavještavamo vas da sporove možete rješavati putem EU platforme za mrežno rješavanje sporova (ODR):<br />
          <a href="https://ec.europa.eu/consumers/odr" target="_blank" rel="noopener noreferrer">ec.europa.eu/consumers/odr</a><br />
          Za pritužbe i prigovore: <a href="mailto:pravna@trampaj.hr">pravna@trampaj.hr</a>
        </div>
        <p>
          &copy; 2026 Diplomat d.o.o. · Trampaj.hr &nbsp;·&nbsp;
          <a href="mailto:pravna@trampaj.hr">Kontakt</a>
          <a href={BASE + "/privacy"}>Privatnost</a>
          <a href={BASE + "/terms"}>Uvjeti</a>
        </p>
      </footer>
    </>
  );
}

export default function App() {
  return (
    <>
      <NeonScreenFrame />
      <Router base={BASE}>
        <Switch>
          <Route path="/terms" component={TermsPage} />
          <Route path="/privacy" component={PrivacyPage} />
          <Route component={LandingPage} />
        </Switch>
      </Router>
    </>
  );
}
