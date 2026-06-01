import { Router, type IRouter } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Resend } from "resend";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, type PublicUser } from "@workspace/db";

const router: IRouter = Router();

const JWT_SECRET = process.env["SESSION_SECRET"] ?? "dev-secret-change-me";
const APP_URL = process.env["REPLIT_DEV_DOMAIN"]
  ? `https://${process.env["REPLIT_DEV_DOMAIN"]}`
  : "http://localhost:80";

// ─── Resend email client ─────────────────────────────────────────────────────
const RESEND_API_KEY = process.env["RESEND_API_KEY"];
let resendClient: Resend | null = null;
function getResend(): Resend | null {
  if (!RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(RESEND_API_KEY);
  return resendClient;
}

// Once trampaj.hr is verified on resend.com/domains, change to: "Trampaj.hr <noreply@trampaj.hr>"
const EMAIL_FROM = "Trampaj.hr <onboarding@resend.dev>";

async function sendVerificationEmail(
  email: string,
  username: string,
  token: string,
): Promise<{ sent: boolean; devLink?: string }> {
  const link = `${APP_URL}/verify-email?token=${token}`;
  const resend = getResend();

  if (!resend) {
    return { sent: false, devLink: link };
  }

  const { error } = await resend.emails.send({
    from: EMAIL_FROM,
    to: email,
    subject: "Potvrdi svoju email adresu — Trampaj.hr",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px">
        <div style="background:#08152E;padding:20px 24px;border-radius:8px;margin-bottom:24px">
          <h1 style="color:#F5C100;margin:0;font-size:22px">🔄 Trampaj.hr</h1>
        </div>
        <h2 style="color:#08152E;margin-top:0">Dobrodošao, ${username}!</h2>
        <p style="color:#444">Klikni na gumb ispod kako bi potvrdio svoju email adresu i aktivirao profil.</p>
        <a href="${link}" style="display:inline-block;background:#F5C100;color:#08152E;font-weight:bold;
          padding:14px 28px;border-radius:8px;text-decoration:none;margin:16px 0;font-size:16px">
          Potvrdi email adresu
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px">Link vrijedi 24 sata. Ako nisi tražio/la registraciju, ignoriraj ovaj email.</p>
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
    subject: "Postavi novu lozinku — Trampaj.hr",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px">
        <div style="background:#08152E;padding:20px 24px;border-radius:8px;margin-bottom:24px">
          <h1 style="color:#F5C100;margin:0;font-size:22px">🔄 Trampaj.hr</h1>
        </div>
        <h2 style="color:#08152E;margin-top:0">Reset lozinke</h2>
        <p style="color:#444">Zdravo ${username}, klikni na gumb ispod kako bi postavio/la novu lozinku. Link vrijedi <strong>1 sat</strong>.</p>
        <a href="${link}" style="display:inline-block;background:#F5C100;color:#08152E;font-weight:bold;
          padding:14px 28px;border-radius:8px;text-decoration:none;margin:16px 0;font-size:16px">
          Postavi novu lozinku
        </a>
        <p style="color:#888;font-size:12px;margin-top:24px">Ako nisi tražio/la reset lozinke, ignoriraj ovaj email.</p>
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

    const hasEmail = !!process.env["RESEND_API_KEY"];
    const autoVerified = !hasEmail;

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
      verificationToken: autoVerified ? null : verificationToken,
      verificationExpiry: autoVerified ? null : verificationExpiry,
      isVerified: autoVerified,
    });

    let actuallyVerified = autoVerified;
    let emailSent = false;
    let devVerifyLink: string | undefined;

    if (!autoVerified) {
      try {
        const emailResult = await sendVerificationEmail(
          email.toLowerCase().trim(),
          username.trim(),
          verificationToken,
        );
        emailSent = emailResult.sent;
        devVerifyLink = emailResult.devLink;
      } catch (emailErr) {
        req.log.warn({ emailErr }, "email send failed — auto-verifying user as fallback");
        // Email not working (domain not verified etc.) — auto-verify so user can still use the app
        actuallyVerified = true;
        await db
          .update(usersTable)
          .set({ isVerified: true, verificationToken: null, verificationExpiry: null })
          .where(eq(usersTable.id, id));
      }
    }

    if (!actuallyVerified) {
      res.status(201).json({
        message: "Registracija uspješna. Provjeri email za potvrdu.",
        emailSent,
        devVerifyLink,
      });
      return;
    }

    const token = jwt.sign({ userId: id, username: username.trim() }, JWT_SECRET, {
      expiresIn: "30d",
    });

    res.status(201).json({
      message: "Registracija uspješna! Možeš se odmah prijaviti.",
      autoVerified: true,
      token,
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
