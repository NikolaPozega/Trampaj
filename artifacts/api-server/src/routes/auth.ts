import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import { randomUUID } from "crypto";
import { eq, sql } from "drizzle-orm";
import fs from "node:fs";
import path from "node:path";
import { db, usersTable, type PublicUser } from "@workspace/db";

const router: IRouter = Router();

const JWT_SECRET = process.env["SESSION_SECRET"] ?? "dev-secret-change-me";

// Logo embedded as data URI so email clients don't need to fetch an external URL
function getLogoImgTag(): string {
  try {
    const logoPath = path.resolve(__dirname, "../public/logo_email.jpg");
    if (!fs.existsSync(logoPath)) return "";
    const b64 = fs.readFileSync(logoPath).toString("base64");
    return `<img src="data:image/jpeg;base64,${b64}" alt="Trampaj.hr" width="520" style="display:block;width:100%;max-width:520px;height:auto" />`;
  } catch { return ""; }
}
const APP_URL = (() => {
  const prod = process.env["REPLIT_DOMAINS"]?.split(",")[0]?.trim();
  if (prod) return `https://${prod}`;
  const dev = process.env["REPLIT_DEV_DOMAIN"];
  if (dev) return `https://${dev}`;
  return "http://localhost:80";
})();

// ─── Resend email client ─────────────────────────────────────────────────────
const RESEND_API_KEY = process.env["RESEND_API_KEY"];
let resendClient: Resend | null = null;
function getResend(): Resend | null {
  if (!RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(RESEND_API_KEY);
  return resendClient;
}

const EMAIL_FROM = "Trampaj.hr <noreply@trampaj.hr>";

async function sendVerificationEmail(
  email: string,
  username: string,
  token: string,
): Promise<{ sent: boolean; devLink?: string }> {
  const link = `${APP_URL}/api/auth/verify/${token}`;
  const resend = getResend();

  if (!resend) {
    return { sent: false, devLink: link };
  }

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: "Potvrdi svoju email adresu — Trampaj.hr",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:0;background:#ffffff">
        <div style="background:#08152E;border-radius:8px 8px 0 0;overflow:hidden;text-align:center">
          ${getLogoImgTag()}
        </div>
        <div style="padding:28px 28px 20px;background:#ffffff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          <p style="color:#111;font-size:15px;margin:0 0 6px">Poštovani/a <strong>${username}</strong>,</p>
          <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 20px">
            hvala na registraciji na <strong>Trampaj.hr</strong>. Kako bismo potvrdili vašu email adresu i aktivirali vaš korisnički račun, molimo kliknite na gumb u nastavku.
          </p>
          <div style="text-align:center;margin:24px 0">
            <a href="${link}" style="display:inline-block;background:#F5C100;color:#08152E;font-weight:700;
              padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;letter-spacing:0.2px">
              Potvrdi email adresu
            </a>
          </div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px">
          <p style="color:#555;font-size:13px;line-height:1.6;margin:0 0 16px">
            Hvala na povjerenju i sretno u trampanju!
          </p>
          <p style="color:#888;font-size:12px;line-height:1.6;margin:0">
            Link za potvrdu vrijedi <strong>24 sata</strong>. Ako niste tražili registraciju na Trampaj.hr, možete zanemariti ovaj email — vaša adresa neće biti aktivirana.<br><br>
            <em>Ovo je automatski generirana poruka. Molimo ne odgovarajte na ovaj email.</em>
          </p>
        </div>
        <p style="text-align:center;color:#aaa;font-size:11px;padding:12px 0">Trampaj.hr — Jedna trampa, dvije sretne strane</p>
      </div>
    `,
  });

  if (error) throw new Error(error.message);
  return { sent: true };
}

function toPublicUser(u: typeof usersTable.$inferSelect): PublicUser {
  const { passwordHash: _, verificationToken: __, verificationExpiry: ___, resetToken: ____, resetTokenExpiry: _____, ...pub } = u;
  return pub;
}

async function sendPasswordResetEmail(
  email: string,
  username: string,
  token: string,
): Promise<{ sent: boolean; devLink?: string }> {
  const link = `${APP_URL}/reset-password?token=${token}`;
  const resend = getResend();

  if (!resend) {
    return { sent: false, devLink: link };
  }

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: "Postavljanje nove lozinke — Trampaj.hr",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:0;background:#ffffff">
        <div style="background:#08152E;border-radius:8px 8px 0 0;overflow:hidden;text-align:center">
          ${getLogoImgTag()}
        </div>
        <div style="padding:28px 28px 20px;background:#ffffff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">
          <p style="color:#111;font-size:15px;margin:0 0 6px">Poštovani/a <strong>${username}</strong>,</p>
          <p style="color:#444;font-size:14px;line-height:1.6;margin:0 0 20px">
            primili smo zahtjev za postavljanje nove lozinke za vaš korisnički račun na <strong>Trampaj.hr</strong>. Kliknite na gumb u nastavku kako biste postavili novu lozinku.
          </p>
          <div style="text-align:center;margin:24px 0">
            <a href="${link}" style="display:inline-block;background:#F5C100;color:#08152E;font-weight:700;
              padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;letter-spacing:0.2px">
              Postavi novu lozinku
            </a>
          </div>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 20px">
          <p style="color:#555;font-size:13px;line-height:1.6;margin:0 0 16px">
            Hvala na povjerenju i sretno u trampanju!
          </p>
          <p style="color:#888;font-size:12px;line-height:1.6;margin:0">
            Link za postavljanje lozinke vrijedi <strong>1 sat</strong>. Ako niste tražili reset lozinke, možete zanemariti ovaj email — vaša trenutna lozinka ostaje nepromijenjena.<br><br>
            <em>Ovo je automatski generirana poruka. Molimo ne odgovarajte na ovaj email.</em>
          </p>
        </div>
        <p style="text-align:center;color:#aaa;font-size:11px;padding:12px 0">Trampaj.hr — Jedna trampa, dvije sretne strane</p>
      </div>
    `,
  });

  if (error) throw new Error(error.message);
  return { sent: true };
}

// ─── POST /api/auth/register ─────────────────────────────────────────────────
router.post("/auth/register", async (req, res) => {
  const { username, email, password, phone, address, city, avatarBase64 } = req.body as {
    username?: string;
    email?: string;
    password?: string;
    phone?: string;
    address?: string;
    city?: string;
    avatarBase64?: string;
  };

  if (!username?.trim() || !email?.trim() || !password) {
    res.status(400).json({ error: "Korisničko ime, email i lozinka su obavezni" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Lozinka mora imati najmanje 6 znakova" });
    return;
  }
  if (!/[A-Z]/.test(password)) {
    res.status(400).json({ error: "Lozinka mora sadržavati najmanje jedno veliko slovo" });
    return;
  }
  if (!/[0-9]/.test(password)) {
    res.status(400).json({ error: "Lozinka mora sadržavati najmanje jedan broj" });
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: "Nevažeća email adresa" });
    return;
  }

  try {
    // Check uniqueness — case-insensitive so "nikola" i "Nikola" ne mogu koegzistirati
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(sql`lower(${usersTable.username}) = lower(${username.trim()})`)
      .limit(1);

    if (existingUser) {
      res.status(409).json({ error: "Korisničko ime je već zauzeto" });
      return;
    }

    const [existingEmail] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    if (existingEmail) {
      res.status(409).json({ error: "Email adresa je već registrirana" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const id = randomUUID();

    // Generate verification token, expires in 24h
    const verifyToken = randomUUID();
    const verifyExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.insert(usersTable).values({
      id,
      username: username.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      city: city?.trim() || null,
      avatarBase64: avatarBase64 || null,
      verificationToken: verifyToken,
      verificationExpiry: verifyExpiry,
      isVerified: false,
    });

    // Send verification email
    let emailSent = false;
    let devVerifyLink: string | undefined;
    try {
      const result = await sendVerificationEmail(email.toLowerCase().trim(), username.trim(), verifyToken);
      emailSent = result.sent;
      devVerifyLink = result.devLink;
    } catch { /* email failure never blocks registration */ }

    // Telegram notifikacija — fire & forget
    setImmediate(async () => {
      try {
        const { sendTelegramMessage } = await import("../lib/telegram");
        await sendTelegramMessage(
          `👤 <b>Novi korisnik registriran!</b>\n@${username.trim()} — ${email.toLowerCase().trim()}\n<i>Trampaj.hr · ${new Date().toLocaleString("hr-HR")}</i>`
        );
      } catch { /* silent */ }
    });

    res.status(201).json({
      message: "Registracija uspješna! Provjeri email za aktivaciju profila.",
      emailSent,
      devVerifyLink,
    });
  } catch (err) {
    req.log.error({ err }, "register error");
    res.status(500).json({ error: "Greška pri registraciji" });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post("/auth/login", async (req, res) => {
  const { username, email, password } = req.body as { username?: string; email?: string; password?: string };
  const identifier = (username ?? email ?? "").trim();

  if (!identifier || !password) {
    res.status(400).json({ error: "Korisničko ime/email i lozinka su obavezni" });
    return;
  }

  try {
    const isEmail = identifier.includes("@");
    const [user] = await db
      .select()
      .from(usersTable)
      .where(isEmail ? eq(usersTable.email, identifier) : eq(usersTable.username, identifier))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "Pogrešno korisničko ime ili lozinka" });
      return;
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      res.status(401).json({ error: "Pogrešno korisničko ime ili lozinka" });
      return;
    }

    if (!user.isVerified) {
      res.status(403).json({
        error: "Email adresa nije potvrđena. Provjeri inbox.",
        notVerified: true,
        email: user.email,
      });
      return;
    }

    const token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: "30d",
    });

    res.json({ token, user: toPublicUser(user), isAdmin: user.isAdmin });
  } catch (err) {
    req.log.error({ err }, "login error");
    res.status(500).json({ error: "Greška pri prijavi" });
  }
});

// ─── GET /api/auth/verify/:token ──────────────────────────────────────────────
router.get("/auth/verify/:token", async (req, res) => {
  const { token } = req.params as { token: string };
  const wantJson = req.headers["accept"]?.includes("application/json");

  function htmlPage(ok: boolean, title: string, body: string, deepLink?: string) {
    const script = deepLink
      ? `<script>window.location.replace("${deepLink}");</script>`
      : "";
    const btn = deepLink
      ? `<a href="${deepLink}" class="btn">Otvori aplikaciju →</a>`
      : `<a href="#" onclick="window.close()" class="btn">Zatvori</a>`;
    const visibilityStyle = deepLink ? "visibility:hidden" : "";
    return `<!DOCTYPE html><html lang="hr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Trampaj.hr — Verifikacija emaila</title>
<style>*{box-sizing:border-box}body{font-family:sans-serif;background:#08152E;color:#fff;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;padding:20px;${visibilityStyle}}.card{background:#0f2244;border-radius:16px;padding:32px 24px;max-width:400px;width:100%;text-align:center}.logo{color:#F5C100;font-size:22px;font-weight:bold;margin-bottom:20px}.icon{font-size:60px;margin-bottom:16px}h2{margin:0 0 12px;font-size:20px}p{color:#aaa;font-size:14px;line-height:1.5;margin:0 0 20px}.btn{display:inline-block;background:#F5C100;color:#08152E;font-weight:bold;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:15px}</style>${script}
</head><body><div class="card"><div class="logo">🔄 Trampaj.hr</div>
<div class="icon">${ok ? "✅" : "❌"}</div>
<h2>${title}</h2><p>${body}</p>${btn}</div></body></html>`;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.verificationToken, token))
      .limit(1);

    if (!user) {
      if (wantJson) { res.status(400).json({ error: "Nevažeći ili istekli token" }); return; }
      res.status(400).send(htmlPage(false, "Nevažeći link", "Ovaj link za verifikaciju nije važeći ili je već iskorišten."));
      return;
    }

    if (user.verificationExpiry && user.verificationExpiry < new Date()) {
      if (wantJson) { res.status(400).json({ error: "Token je istekao. Zatraži novi." }); return; }
      res.status(400).send(htmlPage(false, "Link je istekao", "Link je važio 24 sata. Zatraži novi u aplikaciji."));
      return;
    }

    await db
      .update(usersTable)
      .set({ isVerified: true, verificationToken: null, verificationExpiry: null, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    const jwt_token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: "30d",
    });

    if (wantJson) {
      res.json({
        message: "Email potvrđen! Profil je aktivan.",
        token: jwt_token,
        user: toPublicUser({ ...user, isVerified: true, verificationToken: null, verificationExpiry: null }),
      });
      return;
    }

    // Browser flow — redirect to app via deep link carrying the JWT
    const deepLink = `mobile://verify-email?jwt=${jwt_token}`;
    res.send(htmlPage(
      true,
      "Email potvrđen!",
      "Tvoj profil je aktivan. Aplikacija će se otvoriti automatski.",
      deepLink,
    ));
  } catch (err) {
    req.log.error({ err }, "verify error");
    if (wantJson) { res.status(500).json({ error: "Greška pri verifikaciji" }); return; }
    res.status(500).send(htmlPage(false, "Greška", "Došlo je do greške. Pokušaj ponovo."));
  }
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────
router.get("/auth/me", async (req, res) => {
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Nije prijavljen" });
    return;
  }

  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string };
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "Korisnik nije pronađen" });
      return;
    }

    res.json({ user: toPublicUser(user) });
  } catch {
    res.status(401).json({ error: "Token nije važeći" });
  }
});

// ─── PUT /api/auth/profile ────────────────────────────────────────────────────
router.put("/auth/profile", async (req, res) => {
  const auth = req.headers["authorization"];
  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Nije prijavljen" });
    return;
  }

  try {
    const payload = jwt.verify(auth.slice(7), JWT_SECRET) as { userId: string };
    const { username, phone, address, city, avatarBase64 } = req.body as {
      username?: string;
      phone?: string;
      address?: string;
      city?: string;
      avatarBase64?: string;
    };

    const updates: Partial<typeof usersTable.$inferInsert> = { updatedAt: new Date() };
    if (username?.trim()) {
      // Check uniqueness
      const [existing] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.username, username.trim()))
        .limit(1);
      if (existing && existing.id !== payload.userId) {
        res.status(409).json({ error: "Korisničko ime je već zauzeto" });
        return;
      }
      updates.username = username.trim();
    }
    if (phone !== undefined) updates.phone = phone?.trim() || null;
    if (address !== undefined) updates.address = address?.trim() || null;
    if (city !== undefined) updates.city = city?.trim() || null;
    if (avatarBase64 !== undefined) updates.avatarBase64 = avatarBase64 || null;

    await db.update(usersTable).set(updates).where(eq(usersTable.id, payload.userId));

    const [updated] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1);

    res.json({ user: toPublicUser(updated!) });
  } catch (err) {
    req.log.error({ err }, "profile update error");
    res.status(500).json({ error: "Greška pri ažuriranju profila" });
  }
});

// ─── POST /api/auth/forgot-password ───────────────────────────────────────────
router.post("/auth/forgot-password", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email?.trim()) {
    res.status(400).json({ error: "Email je obavezan" });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase().trim()))
      .limit(1);

    // Always return success to avoid email enumeration
    if (!user || !user.isVerified) {
      res.json({ message: "Ako postoji potvrđeni račun s tim emailom, poslan je link za reset." });
      return;
    }

    const resetToken = randomUUID();
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db
      .update(usersTable)
      .set({ resetToken, resetTokenExpiry, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    const result = await sendPasswordResetEmail(user.email, user.username, resetToken);

    res.json({
      message: "Ako postoji potvrđeni račun s tim emailom, poslan je link za reset.",
      emailSent: result.sent,
      devResetLink: result.devLink,
    });
  } catch (err) {
    req.log.error({ err }, "forgot-password error");
    res.status(500).json({ error: "Greška pri slanju emaila" });
  }
});

// ─── POST /api/auth/reset-password ────────────────────────────────────────────
router.post("/auth/reset-password", async (req, res) => {
  const { token, newPassword } = req.body as { token?: string; newPassword?: string };
  if (!token?.trim() || !newPassword) {
    res.status(400).json({ error: "Token i nova lozinka su obavezni" });
    return;
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: "Lozinka mora imati najmanje 6 znakova" });
    return;
  }
  if (!/[A-Z]/.test(newPassword)) {
    res.status(400).json({ error: "Lozinka mora sadržavati najmanje jedno veliko slovo" });
    return;
  }
  if (!/[0-9]/.test(newPassword)) {
    res.status(400).json({ error: "Lozinka mora sadržavati najmanje jedan broj" });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.resetToken, token.trim()))
      .limit(1);

    if (!user) {
      res.status(400).json({ error: "Nevažeći ili istekli link za reset" });
      return;
    }

    if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
      res.status(400).json({ error: "Link za reset je istekao. Zatraži novi." });
      return;
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await db
      .update(usersTable)
      .set({ passwordHash, resetToken: null, resetTokenExpiry: null, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    const jwtToken = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: "30d",
    });

    res.json({
      message: "Lozinka je uspješno promijenjena.",
      token: jwtToken,
      user: toPublicUser({ ...user, passwordHash, resetToken: null, resetTokenExpiry: null }),
    });
  } catch (err) {
    req.log.error({ err }, "reset-password error");
    res.status(500).json({ error: "Greška pri resetiranju lozinke" });
  }
});

// ─── POST /api/auth/resend-verification ───────────────────────────────────────
router.post("/auth/resend-verification", async (req, res) => {
  const { email } = req.body as { email?: string };
  if (!email) { res.status(400).json({ error: "Email je obavezan" }); return; }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);

    if (!user || user.isVerified) {
      res.json({ message: "Ako email postoji, poslan je link za potvrdu." });
      return;
    }

    const token = randomUUID();
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await db.update(usersTable).set({ verificationToken: token, verificationExpiry: expiry }).where(eq(usersTable.id, user.id));

    const result = await sendVerificationEmail(user.email, user.username, token);
    res.json({ message: "Link poslan.", emailSent: result.sent, devVerifyLink: result.devLink });
  } catch (err) {
    req.log.error({ err }, "resend error");
    res.status(500).json({ error: "Greška" });
  }
});

export default router;
