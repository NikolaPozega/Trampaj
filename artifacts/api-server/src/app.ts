import { initSentry, Sentry } from "./lib/sentry";
initSentry(); // mora biti prvo — hvata sve greške ispod

import express, { type Express } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import pinoHttp from "pino-http";
import path from "node:path";
import fs from "node:fs";
import https from "node:https";
import router from "./routes";
import { logger } from "./lib/logger";
import { WebhookHandlers } from "./webhookHandlers";
import { landingPageHtml } from "./landingPage";

const app: Express = express();

app.set("trust proxy", 1);
app.set("etag", false);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) { return { id: req.id, method: req.method, url: req.url?.split("?")[0] }; },
      res(res) { return { statusCode: res.statusCode }; },
    },
  }),
);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "data:"],
    },
  },
}));

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
      if (!origin || ALLOWED_ORIGINS.some(r => r.test(origin))) cb(null, true);
      else cb(new Error("CORS: nedozvoljen izvor"));
    },
    credentials: true,
  }),
);

const isLocalhost = (req: express.Request) => {
  const ip = req.ip ?? req.socket?.remoteAddress ?? "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
};
const globalLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300, standardHeaders: true, legacyHeaders: false, skip: isLocalhost });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, skip: isLocalhost });

app.use("/api", globalLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// Stripe webhook mora biti PRIJE express.json()
app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (!signature) { res.status(400).json({ error: "Missing stripe-signature header" }); return; }
  const sig = Array.isArray(signature) ? signature[0] : signature;
  try {
    await WebhookHandlers.processWebhook(req.body as Buffer, sig);
    res.status(200).json({ received: true });
  } catch (err) {
    logger.error({ err }, "Stripe webhook error");
    res.status(400).json({ error: "Webhook processing failed" });
  }
});

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ─── Static assets (slike za emailove i sl.) ──────────────────────────────────
const PUBLIC_DIR = path.resolve(__dirname, "../public");
if (fs.existsSync(PUBLIC_DIR)) {
  app.use("/static", express.static(PUBLIC_DIR, { maxAge: "7d" }));
}

// ─── APK download ─────────────────────────────────────────────────────────────
app.get("/download/app", (_req, res) => {
  const APK_URL = "https://expo.dev/artifacts/eas/edAk41KAp4AKysLhbASGie.apk";
  const token = process.env.EXPO_TOKEN;

  const doRequest = (url: string, redirects = 5): void => {
    if (redirects === 0) { res.status(502).send("Previše preusmjeravanja"); return; }
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: token && parsed.hostname.includes("expo.dev")
        ? { Authorization: `Bearer ${token}` }
        : {},
    };
    https.get(options, (upstream) => {
      if (upstream.statusCode && upstream.statusCode >= 300 && upstream.statusCode < 400 && upstream.headers.location) {
        upstream.resume();
        doRequest(upstream.headers.location, redirects - 1);
        return;
      }
      if (!upstream.statusCode || upstream.statusCode >= 400) {
        res.status(502).send("APK trenutno nedostupan");
        return;
      }
      res.setHeader("Content-Type", "application/vnd.android.package-archive");
      res.setHeader("Content-Disposition", 'attachment; filename="Trampa.apk"');
      if (upstream.headers["content-length"]) {
        res.setHeader("Content-Length", upstream.headers["content-length"]);
      }
      upstream.pipe(res);
    }).on("error", () => res.status(502).send("Greška pri preuzimanju APK-a"));
  };

  doRequest(APK_URL);
});

// ─── Svi API odgovori: bez cachea (sprječava 304 bug na Androidu) ─────────────
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// ─── API rute ─────────────────────────────────────────────────────────────────
app.use("/api", router);

// ─── Sentry error handler — mora biti nakon svih ruta ────────────────────────
Sentry.setupExpressErrorHandler(app);

// ─── Root → landing page ──────────────────────────────────────────────────────
app.get("/", (_req, res) => {
  res.redirect(302, "/web/");
});

// ─── Expo Web App — servira statički build iz mobile/dist/web ─────────────────
const WEB_ROOT = path.resolve(__dirname, "../../mobile/dist/web");

if (fs.existsSync(WEB_ROOT)) {
  app.use(express.static(WEB_ROOT, {
    maxAge: "1y",
    immutable: true,
    index: false,
    dotfiles: "allow",
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-cache");
      }
    },
  }));

  // SPA fallback — Expo Router handle-a sve navigacijske rute
  app.get("/{*path}", (_req, res) => {
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(WEB_ROOT, "index.html"));
  });
} else {
  app.get("/{*path}", (_req, res) => {
    res.redirect(302, "/mobile");
  });
}

export default app;
