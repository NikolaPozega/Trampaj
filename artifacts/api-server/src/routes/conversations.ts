import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { eq, and, or, asc } from "drizzle-orm";
import { db, conversationsTable, messagesTable, listingsTable, usersTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";
import admin from "firebase-admin";
import { logger } from "../lib/logger";

// Inicijaliziraj Firebase Admin SDK jednom
if (!admin.apps.length) {
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (!raw) {
    logger.warn("FIREBASE_SERVICE_ACCOUNT nije postavljen — push notifikacije neće raditi");
  } else {
    logger.info({ rawSecretLen: raw.length, rawStart: raw.substring(0, 10) }, "FIREBASE_SERVICE_ACCOUNT raw secret");
    try {
      const trimmed = raw.trim();

      // Normalizira PEM key — rješava sve poznate varijante formatiranja
      const normalizePEM = (pem: string): string => {
        // 1. Ukloni JSON encoding (\\n → \n)
        let k = pem.replace(/\\n/g, "\n").replace(/\\r/g, "").replace(/\r/g, "").trim();
        // 2. Pronađi header i footer
        const headerMatch = k.match(/-----BEGIN ([^-\n]+)-----/);
        const footerMatch = k.match(/-----END ([^-\n]+)-----/);
        if (!headerMatch || !footerMatch) return k;
        const header = `-----BEGIN ${headerMatch[1]}-----`;
        const footer = `-----END ${footerMatch[1]}-----`;
        // 3. Izvuci samo base64 podatke (bez headera, footera, whitespace)
        const body = k
          .replace(header, "")
          .replace(footer, "")
          .replace(/\s+/g, "");
        // 4. Rekonstruiraj s pravilnim 64-char redovima
        const lines = body.match(/.{1,64}/g) ?? [];
        return `${header}\n${lines.join("\n")}\n${footer}\n`;
      };

      let serviceAccount: admin.ServiceAccount & { private_key?: string };

      if (trimmed.startsWith("{")) {
        serviceAccount = JSON.parse(trimmed) as admin.ServiceAccount & { private_key?: string };
        if (serviceAccount.private_key) {
          serviceAccount.private_key = normalizePEM(serviceAccount.private_key);
        }
        // Drizzle fallback: ponekad Firebase očekuje camelCase
        const sa = serviceAccount as Record<string, unknown>;
        if (!sa["privateKey"] && sa["private_key"]) sa["privateKey"] = sa["private_key"];
      } else {
        // Samo PEM ključ (bez JSON omotača)
        serviceAccount = {
          projectId: "trampaj-8faed",
          clientEmail: "firebase-adminsdk-fbsvc@trampaj-8faed.iam.gserviceaccount.com",
          privateKey: normalizePEM(trimmed),
        };
      }

      // Dijagnostika ključa (bez otkrivanja sadržaja)
      const rawKey = (serviceAccount.private_key ?? (serviceAccount as Record<string,unknown>)["privateKey"] as string ?? "");
      const keyLines = rawKey.split("\n").length;
      const keyLen = rawKey.length;
      const hasHeader = rawKey.includes("-----BEGIN PRIVATE KEY-----");
      const hasFooter = rawKey.includes("-----END PRIVATE KEY-----");
      const hasActualNewlines = rawKey.includes("\n");
      logger.info({ keyLines, keyLen, hasHeader, hasFooter, hasActualNewlines }, "Firebase key diagnostics");

      // Pokušaj direktnog parsiranja Node crypto-om
      try {
        const { createPrivateKey } = await import("crypto");
        createPrivateKey(rawKey);
        logger.info("Node crypto: ključ validan ✅");
      } catch (ce) {
        logger.error({ msg: (ce as Error).message }, "Node crypto: ključ nevalidan");
      }

      admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
      logger.info("Firebase Admin SDK inicijaliziran ✅");
    } catch (e) {
      logger.error({ err: e }, "Firebase Admin SDK inicijalizacija neuspješna");
    }
  }
}

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

const router: IRouter = Router();

interface MessageRow {
  id: string;
  conversationId: string;
  fromUserId: string;
  text: string;
  type: string;
  createdAt: Date;
}

interface ConvRow {
  id: string;
  listingId: string;
  initiatorId: string;
  ownerId: string;
  dealShown: boolean;
  disclaimerAccepted: boolean;
  deliveryMethod: string | null;
  escrowActive: boolean;
  initiatorLastReadAt: Date | null;
  ownerLastReadAt: Date | null;
  updatedAt: Date;
  createdAt: Date;
}

function formatMessage(msg: MessageRow, currentUserId: string) {
  return {
    id: msg.id,
    text: msg.text,
    type: msg.type,
    fromMe: msg.fromUserId === currentUserId,
    createdAt: msg.createdAt.getTime(),
  };
}

async function buildConversationPayload(
  conv: ConvRow,
  currentUserId: string,
  listingTitle: string,
  otherUserName: string,
  messages: MessageRow[],
) {
  const isInitiator = conv.initiatorId === currentUserId;
  const lastReadAt = isInitiator
    ? (conv.initiatorLastReadAt?.getTime() ?? 0)
    : (conv.ownerLastReadAt?.getTime() ?? 0);

  return {
    id: conv.id,
    listingId: conv.listingId,
    listingTitle,
    otherUserName,
    messages: messages.map((m) => formatMessage(m, currentUserId)),
    updatedAt: conv.updatedAt.getTime(),
    lastReadAt,
    dealShown: conv.dealShown,
    disclaimerAccepted: conv.disclaimerAccepted,
    deliveryInfo: conv.deliveryMethod
      ? { method: conv.deliveryMethod as "courier" | "personal", escrowActive: conv.escrowActive }
      : undefined,
  };
}


// GET /api/conversations
router.get("/conversations", requireAuth, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(conversationsTable)
      .where(or(eq(conversationsTable.initiatorId, req.userId!), eq(conversationsTable.ownerId, req.userId!))) as ConvRow[];

    const result = await Promise.all(rows.map(async (conv) => {
      const otherUserId = conv.initiatorId === req.userId ? conv.ownerId : conv.initiatorId;

      const [listing] = await db.select({ title: listingsTable.title }).from(listingsTable)
        .where(eq(listingsTable.id, conv.listingId)).limit(1);
      const [otherUser] = await db.select({ username: usersTable.username }).from(usersTable)
        .where(eq(usersTable.id, otherUserId)).limit(1);
      const messages = await db.select().from(messagesTable)
        .where(eq(messagesTable.conversationId, conv.id))
        .orderBy(asc(messagesTable.createdAt)) as MessageRow[];

      return buildConversationPayload(conv, req.userId!, listing?.title ?? "Oglas", otherUser?.username ?? "Korisnik", messages);
    }));

    res.json({ conversations: result });
  } catch (err) {
    req.log.error({ err }, "conversations list error");
    res.status(500).json({ error: "Greška pri dohvatu razgovora" });
  }
});

// POST /api/conversations
router.post("/conversations", requireAuth, async (req: AuthRequest, res) => {
  const { listingId } = req.body as { listingId?: string };
  if (!listingId) { res.status(400).json({ error: "listingId je obavezan" }); return; }

  try {
    const [listing] = await db.select({ id: listingsTable.id, userId: listingsTable.userId, title: listingsTable.title })
      .from(listingsTable).where(eq(listingsTable.id, listingId)).limit(1);
    if (!listing) { res.status(404).json({ error: "Oglas nije pronađen" }); return; }
    if (listing.userId === req.userId) { res.status(400).json({ error: "Ne možeš razgovarati sa sobom" }); return; }

    // Return existing conversation if it exists
    const [existing] = await db.select().from(conversationsTable)
      .where(and(eq(conversationsTable.listingId, listingId), eq(conversationsTable.initiatorId, req.userId!)))
      .limit(1) as ConvRow[];

    if (existing) {
      const [otherUser] = await db.select({ username: usersTable.username }).from(usersTable)
        .where(eq(usersTable.id, listing.userId)).limit(1);
      const messages = await db.select().from(messagesTable)
        .where(eq(messagesTable.conversationId, existing.id))
        .orderBy(asc(messagesTable.createdAt)) as MessageRow[];
      const formatted = await buildConversationPayload(existing, req.userId!, listing.title, otherUser?.username ?? "Korisnik", messages);
      res.json({ conversation: formatted });
      return;
    }

    const id = randomUUID();
    await db.insert(conversationsTable).values({
      id,
      listingId,
      initiatorId: req.userId!,
      ownerId: listing.userId,
    });

    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id)).limit(1) as ConvRow[];
    const [otherUser] = await db.select({ username: usersTable.username }).from(usersTable)
      .where(eq(usersTable.id, listing.userId)).limit(1);
    const formatted = await buildConversationPayload(conv!, req.userId!, listing.title, otherUser?.username ?? "Korisnik", []);
    res.status(201).json({ conversation: formatted });
  } catch (err) {
    req.log.error({ err }, "conversation create error");
    res.status(500).json({ error: "Greška pri kreiranju razgovora" });
  }
});

// GET /api/conversations/:id/messages
router.get("/conversations/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };
  try {
    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id)).limit(1) as ConvRow[];
    if (!conv) { res.status(404).json({ error: "Razgovor nije pronađen" }); return; }
    if (conv.initiatorId !== req.userId && conv.ownerId !== req.userId) {
      res.status(403).json({ error: "Nemaš pristup" }); return;
    }
    const messages = await db.select().from(messagesTable)
      .where(eq(messagesTable.conversationId, id))
      .orderBy(asc(messagesTable.createdAt)) as MessageRow[];
    res.json({ messages: messages.map((m) => formatMessage(m, req.userId!)) });
  } catch (err) {
    req.log.error({ err }, "messages get error");
    res.status(500).json({ error: "Greška" });
  }
});

// POST /api/conversations/:id/messages
router.post("/conversations/:id/messages", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };
  const { text, type = "text" } = req.body as { text?: string; type?: string };

  try {
    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id)).limit(1) as ConvRow[];
    if (!conv) { res.status(404).json({ error: "Razgovor nije pronađen" }); return; }
    if (conv.initiatorId !== req.userId && conv.ownerId !== req.userId) {
      res.status(403).json({ error: "Nemaš pristup" }); return;
    }

    const msgId = randomUUID();
    await db.insert(messagesTable).values({
      id: msgId,
      conversationId: id,
      fromUserId: req.userId!,
      text: text ?? "",
      type,
    });
    await db.update(conversationsTable).set({ updatedAt: new Date() }).where(eq(conversationsTable.id, id));

    const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, msgId)).limit(1) as MessageRow[];
    res.status(201).json({ message: formatMessage(msg!, req.userId!) });

    // ── Push notification to the other user ───────────────────────────────────
    void (async () => {
      try {
        const otherUserId = conv.initiatorId === req.userId ? conv.ownerId : conv.initiatorId;
        const [otherUser] = await db.select({ pushToken: usersTable.pushToken, username: usersTable.username })
          .from(usersTable).where(eq(usersTable.id, otherUserId)).limit(1);
        const [sender] = await db.select({ username: usersTable.username })
          .from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
        if (otherUser?.pushToken) {
          const body = type === "text" ? (text ?? "") : "Poslao/la je zahtjev za dogovor";
          const message: admin.messaging.Message = {
            token: otherUser.pushToken,
            notification: { title: sender?.username ?? "Trampaj", body },
            android: {
              collapseKey: `conv_${id}`,
              notification: {
                tag: `conv_${id}`,
                channelId: "poruke",
                sound: "default",
                defaultVibrateTimings: false,
                vibrateTimingsMillis: [0, 200, 100, 200],
                color: "#F5C100",
                notificationCount: 1,
              },
              priority: "high",
            },
            data: { listingId: conv.listingId, conversationId: id },
          };
          const msgId = await admin.messaging().send(message);
          req.log.info({ msgId }, "push sent via FCM");
        } else {
          req.log.info({ otherUserId: conv.initiatorId === req.userId ? conv.ownerId : conv.initiatorId }, "push skip: no token");
        }
      } catch (pushErr) { req.log.warn({ pushErr }, "push send exception"); }
    })();

    // ── TrampaDemo bot: auto-respond to handshake_request ─────────────────────
    if (type === "handshake_request") {
      const otherUserId = conv.initiatorId === req.userId ? conv.ownerId : conv.initiatorId;
      if (otherUserId === DEMO_USER_ID) {
        setTimeout(() => {
          void (async () => {
            try {
              await db.insert(messagesTable).values({
                id: randomUUID(),
                conversationId: id,
                fromUserId: DEMO_USER_ID,
                text: "",
                type: "handshake_accepted",
              });
              await db.update(conversationsTable)
                .set({ updatedAt: new Date() })
                .where(eq(conversationsTable.id, id));
            } catch { /* silent */ }
          })();
        }, 2000);
      }
    }
  } catch (err) {
    req.log.error({ err }, "message send error");
    res.status(500).json({ error: "Greška pri slanju poruke" });
  }
});

// PATCH /api/conversations/:id
router.patch("/conversations/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };
  const { dealShown, disclaimerAccepted, deliveryMethod, escrowActive, markAsRead } = req.body as Record<string, unknown>;

  try {
    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id)).limit(1) as ConvRow[];
    if (!conv) { res.status(404).json({ error: "Razgovor nije pronađen" }); return; }
    if (conv.initiatorId !== req.userId && conv.ownerId !== req.userId) {
      res.status(403).json({ error: "Nemaš pristup" }); return;
    }

    const updates: Partial<typeof conversationsTable.$inferInsert> = {};
    if (typeof dealShown === "boolean") updates.dealShown = dealShown;
    if (typeof disclaimerAccepted === "boolean") updates.disclaimerAccepted = disclaimerAccepted;
    if (typeof deliveryMethod === "string") updates.deliveryMethod = deliveryMethod;
    if (typeof escrowActive === "boolean") updates.escrowActive = escrowActive;
    if (markAsRead === true) {
      const now = new Date();
      if (conv.initiatorId === req.userId) updates.initiatorLastReadAt = now;
      else updates.ownerLastReadAt = now;
    }

    if (Object.keys(updates).length > 0) {
      await db.update(conversationsTable).set(updates).where(eq(conversationsTable.id, id));
    }
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "conversation patch error");
    res.status(500).json({ error: "Greška" });
  }
});

// DELETE /api/conversations/:id
router.delete("/conversations/:id", requireAuth, async (req: AuthRequest, res) => {
  const { id } = req.params as { id: string };
  try {
    const [conv] = await db.select().from(conversationsTable).where(eq(conversationsTable.id, id)).limit(1) as ConvRow[];
    if (!conv) { res.status(404).json({ error: "Razgovor nije pronađen" }); return; }
    if (conv.initiatorId !== req.userId && conv.ownerId !== req.userId) {
      res.status(403).json({ error: "Nemaš pristup" }); return;
    }
    // CASCADE briše messages + escrow_deposits automatski
    await db.delete(conversationsTable).where(eq(conversationsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "conversation delete error");
    res.status(500).json({ error: "Greška pri brisanju razgovora" });
  }
});

export default router;
