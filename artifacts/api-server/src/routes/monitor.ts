import { Router, type IRouter } from "express";
import { db, listingsTable, usersTable } from "@workspace/db";
import { count } from "drizzle-orm";
import { sendAlertEmail } from "../lib/alertEmail";
import { sendTelegramMessage } from "../lib/telegram";
import { logger } from "../lib/logger";

const router: IRouter = Router();

interface CheckResult {
  name: string;
  status: "ok" | "error";
  latencyMs: number;
  detail?: string;
}

let lastAlertAt: number | null = null;
const ALERT_COOLDOWN_MS = 15 * 60 * 1000; // 15 min između alertova

async function runChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  // DB check
  const dbStart = Date.now();
  try {
    await db.select({ c: count() }).from(usersTable);
    results.push({ name: "Baza podataka", status: "ok", latencyMs: Date.now() - dbStart });
  } catch (err) {
    results.push({ name: "Baza podataka", status: "error", latencyMs: Date.now() - dbStart, detail: String(err) });
  }

  // Listings table
  const listStart = Date.now();
  try {
    await db.select({ c: count() }).from(listingsTable);
    results.push({ name: "Oglasi tablica", status: "ok", latencyMs: Date.now() - listStart });
  } catch (err) {
    results.push({ name: "Oglasi tablica", status: "error", latencyMs: Date.now() - listStart, detail: String(err) });
  }

  // Memory check — use RSS vs ~512MB realistic limit, not heap% (heap% always looks high on startup)
  const mem = process.memoryUsage();
  const heapMb = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMb = Math.round(mem.heapTotal / 1024 / 1024);
  const rssMb = Math.round(mem.rss / 1024 / 1024);
  const heapPct = Math.round((mem.heapUsed / mem.heapTotal) * 100);
  results.push({
    name: "Memorija",
    status: rssMb > 400 ? "error" : heapPct > 97 ? "error" : "ok",
    latencyMs: 0,
    detail: `${heapMb}MB / ${heapTotalMb}MB heap (${heapPct}%), RSS ${rssMb}MB`,
  });

  // Uptime
  const uptimeSec = Math.round(process.uptime());
  const h = Math.floor(uptimeSec / 3600);
  const m = Math.floor((uptimeSec % 3600) / 60);
  results.push({
    name: "Uptime",
    status: "ok",
    latencyMs: 0,
    detail: `${h}h ${m}m`,
  });

  return results;
}

// GET /api/monitor/status — public health + detailed check
router.get("/monitor/status", async (req, res) => {
  try {
    const checks = await runChecks();
    const allOk = checks.every(c => c.status === "ok");
    res.json({
      ok: allOk,
      timestamp: Date.now(),
      checks,
    });
  } catch (err) {
    logger.error({ err }, "monitor status error");
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// POST /api/monitor/check — triggera provjeru i šalje email ako ima grešaka (interno)
router.post("/monitor/check", async (req, res) => {
  try {
    const checks = await runChecks();
    const failed = checks.filter(c => c.status === "error");

    if (failed.length > 0) {
      const now = Date.now();
      const canAlert = !lastAlertAt || (now - lastAlertAt) > ALERT_COOLDOWN_MS;

      if (canAlert) {
        lastAlertAt = now;
        const body = failed.map(c => `❌ ${c.name}: ${c.detail ?? "greška"}`).join("\n");
        await sendAlertEmail(`${failed.length} servisa nije dostupno`, body);
        const tgMsg = `🚨 <b>Trampaj.hr — Server greška</b>\n\n${failed.map(c => `❌ <b>${c.name}</b>${c.detail ? `\n<code>${c.detail}</code>` : ""}`).join("\n\n")}`;
        await sendTelegramMessage(tgMsg).catch(() => {});
      }
    }

    res.json({ ok: failed.length === 0, checks, alertSent: false });
  } catch (err) {
    logger.error({ err }, "monitor check error");
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// POST /api/monitor/test-alert — šalje test email (zahtijeva admin token)
router.post("/monitor/test-alert", async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ ok: false, message: "Nema autorizacije." });
    return;
  }
  try {
    const checks = await runChecks();
    const summary = checks.map(c => `${c.status === "ok" ? "✅" : "❌"} ${c.name}${c.detail ? `: ${c.detail}` : ""}`).join("\n");
    await sendAlertEmail("Test alert — server radi ✅", `Ovo je test notifikacija.\n\nTrenutni status:\n${summary}`);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "test alert error");
    res.status(500).json({ ok: false, message: "Greška pri slanju emaila." });
  }
});

// POST /api/monitor/test-telegram — šalje test Telegram poruku (zahtijeva admin token)
router.post("/monitor/test-telegram", async (req, res) => {
  const authHeader = req.headers["authorization"];
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ ok: false, message: "Nema autorizacije." });
    return;
  }
  try {
    const { sendTelegramMessage } = await import("../lib/telegram");
    const ok = await sendTelegramMessage("🔔 <b>Test Telegram notifikacija</b>\nTrampaj.hr admin panel je aktivan. ✅");
    if (ok) {
      res.json({ ok: true, message: "Telegram poruka poslana." });
    } else {
      res.status(500).json({ ok: false, message: "TELEGRAM_BOT_TOKEN ili TELEGRAM_CHAT_ID nije postavljen." });
    }
  } catch (err) {
    logger.error({ err }, "test telegram error");
    res.status(500).json({ ok: false, message: "Greška pri slanju Telegram poruke." });
  }
});

export default router;
