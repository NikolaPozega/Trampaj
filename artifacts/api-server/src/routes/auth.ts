import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import nodemailer from "nodemailer";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, type PublicUser } from "@workspace/db";

const router: IRouter = Router();

const JWT_SECRET = process.env["SESSION_SECRET"] ?? "dev-secret-change-me";
const APP_URL = process.env["REPLIT_DEV_DOMAIN"]
  ? `https://${process.env["REPLIT_DEV_DOMAIN"]}`
  : "http://localhost:80";

// ─── Email transport ────────────────────────────────────────────────────────
function getTransport() {
  if (process.env["SMTP_HOST"]) {
    return nodemailer.createTransport({
      host: process.env["SMTP_HOST"],
      port: Number(process.env["SMTP_PORT"] ?? 587),
      secure: process.env["SMTP_SECURE"] === "true",
      auth: {
        user: process.env["SMTP_USER"],
        pass: process.env["SMTP_PASS"],
      },
    });
  }
  return null;
}

async function sendVerificationEmail(
  email: string,
  username: string,
  token: string,
): Promise<{ sent: boolean; devLink?: string }> {
  const link = `${APP_URL}/verify-email?token=${token}`;
  const transport = getTransport();

  if (!transport) {
    // Dev mode: return the link so the app can show it
    return { sent: false, devLink: link };
  }

  await transport.sendMail({
    from: process.env["SMTP_FROM"] ?? `"Trampaj.hr" <noreply@trampaj.hr>`,
    to: email,
    subject: "Potvrdi svoju email adresu — Trampaj.hr",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="color:#08152E">Dobrodošao na Trampaj.hr, ${username}!</h2>
        <p>Klikni na gumb ispod kako bi potvrdio svoju email adresu i aktivirao profil.</p>
        <a href="${link}" style="display:inline-block;background:#F5C100;color:#08152E;font-weight:bold;
          padding:14px 28px;border-radius:8px;text-decoration:none;margin:16px 0">
          Potvrdi email adresu
        </a>
        <p style="color:#666;font-size:12px">Link vrijedi 24 sata. Ako nisi tražio/la registraciju, ignoriraj ovaj email.</p>
        <p style="color:#666;font-size:12px">Ili kopiraj: ${link}</p>
      </div>
    `,
  });

  return { sent: true };
}

function toPublicUser(u: typeof usersTable.$inferSelect): PublicUser {
  const { passwordHash: _, verificationToken: __, verificationExpiry: ___, ...pub } = u;
  return pub;
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

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    res.status(400).json({ error: "Nevažeća email adresa" });
    return;
  }

  try {
    // Check uniqueness
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username.trim()))
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
    const verificationToken = randomUUID();
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const id = randomUUID();
    await db.insert(usersTable).values({
      id,
      username: username.trim(),
      email: email.toLowerCase().trim(),
      passwordHash,
      phone: phone?.trim() || null,
      address: address?.trim() || null,
      city: city?.trim() || null,
      avatarBase64: avatarBase64 || null,
      verificationToken,
      verificationExpiry,
    });

    const emailResult = await sendVerificationEmail(
      email.toLowerCase().trim(),
      username.trim(),
      verificationToken,
    );

    res.status(201).json({
      message: "Registracija uspješna. Provjeri email za potvrdu.",
      emailSent: emailResult.sent,
      // Only in dev mode (no SMTP configured)
      devVerifyLink: emailResult.devLink,
    });
  } catch (err) {
    req.log.error({ err }, "register error");
    res.status(500).json({ error: "Greška pri registraciji" });
  }
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post("/auth/login", async (req, res) => {
  const { username, password } = req.body as { username?: string; password?: string };

  if (!username?.trim() || !password) {
    res.status(400).json({ error: "Korisničko ime i lozinka su obavezni" });
    return;
  }

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.username, username.trim()))
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

    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    req.log.error({ err }, "login error");
    res.status(500).json({ error: "Greška pri prijavi" });
  }
});

// ─── GET /api/auth/verify/:token ──────────────────────────────────────────────
router.get("/auth/verify/:token", async (req, res) => {
  const { token } = req.params as { token: string };

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.verificationToken, token))
      .limit(1);

    if (!user) {
      res.status(400).json({ error: "Nevažeći ili istekli token" });
      return;
    }

    if (user.verificationExpiry && user.verificationExpiry < new Date()) {
      res.status(400).json({ error: "Token je istekao. Zatraži novi." });
      return;
    }

    await db
      .update(usersTable)
      .set({ isVerified: true, verificationToken: null, verificationExpiry: null, updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));

    const jwt_token = jwt.sign({ userId: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: "30d",
    });

    res.json({
      message: "Email potvrđen! Profil je aktivan.",
      token: jwt_token,
      user: toPublicUser({ ...user, isVerified: true, verificationToken: null, verificationExpiry: null }),
    });
  } catch (err) {
    req.log.error({ err }, "verify error");
    res.status(500).json({ error: "Greška pri verifikaciji" });
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
