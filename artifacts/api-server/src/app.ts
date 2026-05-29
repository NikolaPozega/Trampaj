import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";

const app: Express = express();

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
