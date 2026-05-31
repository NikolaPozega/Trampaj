import { Router, type IRouter } from "express";
import { randomUUID } from "crypto";
import { eq, and, or, asc } from "drizzle-orm";
import { db, conversationsTable, messagesTable, listingsTable, usersTable } from "@workspace/db";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

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

export default router;
