import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import http from "node:http";
import router from "./routes";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";

const app: Express = express();

// Replit i ostali reverse proxy-ji postavljaju X-Forwarded-For
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// ─── Sigurnosni headeri ────────────────────────────────────────────────────────
app.use(helmet());

// ─── CORS — dopuštamo samo naše domene ────────────────────────────────────────
const ALLOWED_ORIGINS = [
  /\.replit\.app$/,
  /\.replit\.dev$/,
  /trampaj\.hr$/,
  /localhost/,
  /127\.0\.0\.1/,
];
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || ALLOWED_ORIGINS.some(r => r.test(origin))) {
        cb(null, true);
      } else {
        cb(new Error("CORS: nedozvoljen izvor"));
      }
    },
    credentials: true,
  }),
);

// ─── Rate limiting — zaštita od hakera i botova ────────────────────────────────
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Previše zahtjeva. Pokušaj za 15 minuta." },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Previše pokušaja prijave. Pokušaj za 15 minuta." },
});

app.use("/api", globalLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// ─── Stripe webhook mora biti PRIJE express.json() middleware-a ───────────────
app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      res.status(400).json({ error: "Missing stripe-signature header" });
      return;
    }
    const sig = Array.isArray(signature) ? signature[0] : signature;
    try {
      await WebhookHandlers.processWebhook(req.body as Buffer, sig);
      res.status(200).json({ received: true });
    } catch (err) {
      logger.error({ err }, "Stripe webhook error");
      res.status(400).json({ error: "Webhook processing failed" });
    }
  }
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api", router);

// ─── Expo Go manifest proxy (samo u razvoju) ───────────────────────────────────
// API server je na "/" pa intercepts Expo Go manifest request.
// Kad Expo Go traži manifest s Accept: application/expo+json ili Expo-Platform
// headerom, proxyiramo na Metro dev server (localhost:18115).
app.get("/", (req, res, next) => {
  if (process.env.NODE_ENV !== "development") return next();
  const accept = req.headers["accept"] ?? "";
  const platform = req.headers["expo-platform"];
  if (!accept.includes("application/expo+json") && !platform) return next();

  const proxyReq = http.get(
    {
      hostname: "localhost",
      port: 18115,
      path: "/",
      headers: { ...req.headers, host: "localhost:18115" },
    },
    (proxyRes) => {
      res.statusCode = proxyRes.statusCode ?? 200;
      for (const [k, v] of Object.entries(proxyRes.headers)) {
        if (v !== undefined) res.setHeader(k, v);
      }
      proxyRes.pipe(res);
    },
  );
  proxyReq.on("error", (err) => {
    logger.warn({ err }, "Expo manifest proxy error — Metro nije pokrenut?");
    next();
  });
});

// ─── Web stranica za prijavu / registraciju ────────────────────────────────────
app.get("/prijava", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  // Helmet postavlja strict CSP koji blokira inline <script> — override za ovu stranicu
  res.setHeader("Content-Security-Policy", "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'");
  res.send(`<!DOCTYPE html>
<html lang="hr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Trampaj.hr — Prijava</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{min-height:100%;background:#08152E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#fff}
    body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;padding:24px}
    .card{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:36px 32px;width:100%;max-width:400px;backdrop-filter:blur(12px)}
    .logo{display:flex;align-items:center;gap:12px;margin-bottom:28px;justify-content:center}
    .logo svg{width:48px;height:48px;border-radius:12px}
    .logo-name{font-size:1.6rem;font-weight:800;color:#38BDF8}
    h2{font-size:1.1rem;font-weight:600;color:rgba(255,255,255,.7);text-align:center;margin-bottom:24px}
    .tabs{display:flex;background:rgba(255,255,255,.07);border-radius:10px;padding:4px;margin-bottom:24px}
    .tab{flex:1;text-align:center;padding:8px;border-radius:8px;cursor:pointer;font-size:.9rem;font-weight:600;color:rgba(255,255,255,.5);transition:.2s}
    .tab.active{background:#F5C100;color:#08152E}
    label{display:block;font-size:.8rem;font-weight:600;color:rgba(255,255,255,.5);margin-bottom:6px;margin-top:16px;text-transform:uppercase;letter-spacing:.5px}
    input{width:100%;background:rgba(255,255,255,.07);border:1.5px solid rgba(255,255,255,.12);border-radius:10px;padding:12px 14px;color:#fff;font-size:.95rem;outline:none;transition:.2s}
    input:focus{border-color:#38BDF8;background:rgba(56,189,248,.08)}
    input::placeholder{color:rgba(255,255,255,.3)}
    .btn{width:100%;margin-top:24px;padding:14px;background:#F5C100;color:#08152E;font-weight:800;font-size:1rem;border:none;border-radius:12px;cursor:pointer;transition:.15s}
    .btn:hover{background:#ffd426;transform:translateY(-1px)}
    .btn:active{transform:translateY(0)}
    .btn:disabled{opacity:.5;cursor:not-allowed;transform:none}
    .msg{margin-top:16px;padding:12px 16px;border-radius:10px;font-size:.9rem;text-align:center;display:none}
    .msg.ok{background:rgba(34,197,94,.15);border:1px solid rgba(34,197,94,.3);color:#86efac}
    .msg.err{background:rgba(239,68,68,.15);border:1px solid rgba(239,68,68,.3);color:#fca5a5}
    .form{display:none} .form.active{display:block}
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">
      <svg viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="140" height="140" fill="#08152E" rx="28"/>
        <rect x="22" y="32" width="52" height="52" rx="10" stroke="#38BDF8" stroke-width="5" fill="none"/>
        <rect x="66" y="56" width="52" height="52" rx="10" stroke="#F5C100" stroke-width="5" fill="none"/>
        <path d="M58 58 Q70 45 82 58" stroke="#38BDF8" stroke-width="4" fill="none" stroke-linecap="round" marker-end="url(#a)"/>
        <path d="M82 82 Q70 95 58 82" stroke="#F5C100" stroke-width="4" fill="none" stroke-linecap="round" marker-end="url(#b)"/>
        <defs>
          <marker id="a" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#38BDF8"/></marker>
          <marker id="b" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#F5C100"/></marker>
        </defs>
      </svg>
      <span class="logo-name">Trampaj.hr</span>
    </div>

    <div class="tabs">
      <div class="tab active" id="tab-login">Prijava</div>
      <div class="tab" id="tab-register">Registracija</div>
    </div>

    <!-- Login -->
    <div class="form active" id="form-login">
      <h2>Dobrodošao nazad!</h2>
      <label>Korisničko ime ili email</label>
      <input id="l-user" type="text" placeholder="korisnik ili email@primjer.hr" autocomplete="username"/>
      <label>Lozinka</label>
      <input id="l-pass" type="password" placeholder="••••••••" autocomplete="current-password"/>
      <button class="btn" id="btn-login">Prijavi se</button>
      <div class="msg" id="l-msg"></div>
    </div>

    <!-- Register -->
    <div class="form" id="form-register">
      <h2>Stvori novi račun</h2>
      <label>Korisničko ime</label>
      <input id="r-user" type="text" placeholder="Ivica123" autocomplete="username"/>
      <label>Email adresa</label>
      <input id="r-email" type="email" placeholder="ivica@primjer.hr" autocomplete="email"/>
      <label>Lozinka</label>
      <input id="r-pass" type="password" placeholder="najmanje 6 znakova" autocomplete="new-password"/>
      <button class="btn" id="btn-register">Registriraj se</button>
      <div class="msg" id="r-msg"></div>
    </div>
  </div>

  <script>
    function switchTab(t) {
      document.getElementById('tab-login').classList.toggle('active', t === 'login');
      document.getElementById('tab-register').classList.toggle('active', t === 'register');
      document.getElementById('form-login').classList.toggle('active', t === 'login');
      document.getElementById('form-register').classList.toggle('active', t === 'register');
    }

    function showMsg(id, text, ok) {
      var el = document.getElementById(id);
      el.textContent = text;
      el.className = 'msg ' + (ok ? 'ok' : 'err');
      el.style.display = 'block';
    }

    document.getElementById('tab-login').addEventListener('click', function() { switchTab('login'); });
    document.getElementById('tab-register').addEventListener('click', function() { switchTab('register'); });

    document.getElementById('btn-login').addEventListener('click', function() {
      var btn = this;
      var identifier = document.getElementById('l-user').value.trim();
      var password = document.getElementById('l-pass').value;
      if (!identifier || !password) { showMsg('l-msg', 'Popuni sva polja', false); return; }
      btn.disabled = true; btn.textContent = 'Prijavljivanje...';
      var body = identifier.indexOf('@') >= 0
        ? JSON.stringify({email: identifier, password: password})
        : JSON.stringify({username: identifier, password: password});
      fetch('/api/auth/login', {method:'POST', headers:{'Content-Type':'application/json'}, body: body})
        .then(function(r) { return r.json().then(function(d) { return {ok: r.ok, d: d}; }); })
        .then(function(res) {
          if (!res.ok) { showMsg('l-msg', res.d.error || 'Greška', false); return; }
          localStorage.setItem('trampaj_token', res.d.token);
          showMsg('l-msg', '✓ Prijava uspješna!', true);
        })
        .catch(function() { showMsg('l-msg', 'Greška pri spajanju na server', false); })
        .finally(function() { btn.disabled = false; btn.textContent = 'Prijavi se'; });
    });

    document.getElementById('btn-register').addEventListener('click', function() {
      var btn = this;
      var username = document.getElementById('r-user').value.trim();
      var email = document.getElementById('r-email').value.trim();
      var password = document.getElementById('r-pass').value;
      if (!username || !email || !password) { showMsg('r-msg', 'Popuni sva polja', false); return; }
      btn.disabled = true; btn.textContent = 'Registracija...';
      fetch('/api/auth/register', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({username: username, email: email, password: password})})
        .then(function(r) { return r.json().then(function(d) { return {ok: r.ok, d: d}; }); })
        .then(function(res) {
          if (!res.ok) { showMsg('r-msg', res.d.error || 'Greška', false); return; }
          showMsg('r-msg', '✓ Račun stvoren! Prijavi se.', true);
          setTimeout(function() { switchTab('login'); }, 1500);
        })
        .catch(function() { showMsg('r-msg', 'Greška pri spajanju na server', false); })
        .finally(function() { btn.disabled = false; btn.textContent = 'Registriraj se'; });
    });

    document.addEventListener('keydown', function(e) {
      if (e.key !== 'Enter') return;
      var active = document.querySelector('.form.active');
      if (active && active.id === 'form-login') document.getElementById('btn-login').click();
      else document.getElementById('btn-register').click();
    });
  </script>
</body>
</html>`);
});

// ─── Landing stranica — samo logo, bez aplikacije ─────────────────────────────
app.get("/", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="hr">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Trampaj.hr — Uskoro</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    html,body{height:100%;background:#08152E;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
    body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;gap:20px;padding:24px}
    .logo{width:140px;height:140px;border-radius:28px;overflow:hidden}
    .logo svg{width:100%;height:100%}
    .name{color:#38BDF8;font-size:2.2rem;font-weight:800;letter-spacing:.5px}
    .slogan{color:#F5C100;font-size:1rem;font-weight:500;text-align:center}
    .soon{color:rgba(255,255,255,.35);font-size:.8rem;margin-top:8px}
  </style>
</head>
<body>
  <div class="logo">
    <svg viewBox="0 0 140 140" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="140" height="140" fill="#08152E" rx="28"/>
      <rect x="22" y="32" width="52" height="52" rx="10" stroke="#38BDF8" stroke-width="5" fill="none"/>
      <rect x="66" y="56" width="52" height="52" rx="10" stroke="#F5C100" stroke-width="5" fill="none"/>
      <path d="M58 58 Q70 45 82 58" stroke="#38BDF8" stroke-width="4" fill="none" stroke-linecap="round" marker-end="url(#a)"/>
      <path d="M82 82 Q70 95 58 82" stroke="#F5C100" stroke-width="4" fill="none" stroke-linecap="round" marker-end="url(#b)"/>
      <defs>
        <marker id="a" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#38BDF8"/></marker>
        <marker id="b" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#F5C100"/></marker>
      </defs>
    </svg>
  </div>
  <div class="name">Trampaj.hr</div>
  <div class="slogan">Jedna trampa, dvije sretne strane!</div>
  <div class="soon">Uskoro dostupno</div>
</body>
</html>`);
});

export default app;
