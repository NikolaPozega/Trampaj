import { Router } from "express";
import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import { db, escrowDepositsTable, conversationsTable } from "@workspace/db";
import { getUncachableStripeClient } from "../stripeClient";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

const ESCROW_CURRENCY = "eur";
const ESCROW_DESCRIPTION = "Zaštitni depozit — Trampaj.hr";
const ESCROW_MIN_CENTS = 100;
const ESCROW_MAX_CENTS = 50000;

// ─── Helper: verify user is participant of conversation ───────────────────────
async function getConversationParticipant(conversationId: string, userId: string) {
  const rows = await db
    .select()
    .from(conversationsTable)
    .where(eq(conversationsTable.id, conversationId))
    .limit(1);

  const conv = rows[0];
  if (!conv) return null;
  if (conv.initiatorId !== userId && conv.ownerId !== userId) return null;

  const otherId = conv.initiatorId === userId ? conv.ownerId : conv.initiatorId;
  return { conv, otherId };
}

// ─── Helper: try to release both holds ───────────────────────────────────────
async function tryReleaseDeposits(conversationId: string) {
  const deposits = await db
    .select()
    .from(escrowDepositsTable)
    .where(eq(escrowDepositsTable.conversationId, conversationId));

  const allConfirmed = deposits.length === 2 && deposits.every((d) => d.status === "confirmed");
  if (!allConfirmed) return false;

  const stripe = await getUncachableStripeClient();
  for (const deposit of deposits) {
    if (deposit.paymentIntentId && deposit.status !== "released") {
      try {
        await stripe.paymentIntents.cancel(deposit.paymentIntentId);
      } catch (e) {
        // Already cancelled / released — ignore
      }
      await db
        .update(escrowDepositsTable)
        .set({ status: "released" })
        .where(eq(escrowDepositsTable.id, deposit.id));
    }
  }
  return true;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/escrow/checkout/:conversationId
 * Kreira Stripe Checkout s manual capture (hold na kartici).
 */
router.post("/checkout/:conversationId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const conversationId = req.params["conversationId"] as string;
    const userId = req.userId!;
    const { successUrl, cancelUrl, amount: amountEur } = req.body as {
      successUrl?: string;
      cancelUrl?: string;
      amount?: number;
    };

    if (!successUrl || !cancelUrl) {
      return res.status(400).json({ error: "successUrl i cancelUrl su obvezni" });
    }

    const amountCents = Math.round((amountEur ?? 5) * 100);
    if (amountCents < ESCROW_MIN_CENTS || amountCents > ESCROW_MAX_CENTS) {
      return res.status(400).json({ error: `Iznos mora biti između 1€ i 500€.` });
    }

    const participant = await getConversationParticipant(conversationId, userId);
    if (!participant) {
      return res.status(403).json({ error: "Nisi sudionik ove konverzacije" });
    }

    // Check if already has a held/confirmed deposit
    const existing = await db
      .select()
      .from(escrowDepositsTable)
      .where(and(
        eq(escrowDepositsTable.conversationId, conversationId),
        eq(escrowDepositsTable.userId, userId)
      ))
      .limit(1);

    if (existing[0] && ["held", "confirmed", "released"].includes(existing[0].status)) {
      return res.json({
        alreadyPaid: true,
        status: existing[0].status,
        sessionId: existing[0].checkoutSessionId,
        amount: existing[0].amount,
      });
    }

    const stripe = await getUncachableStripeClient();
    const depositId = randomUUID();

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: ESCROW_CURRENCY,
            product_data: {
              name: ESCROW_DESCRIPTION,
              description: "Drži se kao zalog dok obje strane potvrde primitak. Vraća se automatski.",
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_intent_data: {
        capture_method: "manual",
        metadata: {
          type: "escrow_deposit",
          conversationId,
          userId,
          depositId,
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        type: "escrow_deposit",
        conversationId,
        userId,
        depositId,
      },
    });

    // Upsert deposit record
    if (existing[0]) {
      await db
        .update(escrowDepositsTable)
        .set({ checkoutSessionId: session.id, status: "pending", amount: amountCents })
        .where(eq(escrowDepositsTable.id, existing[0].id));
    } else {
      await db.insert(escrowDepositsTable).values({
        id: depositId,
        conversationId,
        userId,
        checkoutSessionId: session.id,
        amount: amountCents,
        currency: ESCROW_CURRENCY,
        status: "pending",
      });
    }

    return res.json({
      sessionId: session.id,
      url: session.url,
      amount: amountCents,
      currency: ESCROW_CURRENCY,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "Escrow checkout creation failed");
    if (message.includes("not connected") || message.includes("Missing Replit")) {
      return res.status(503).json({ error: "Stripe nije spojen. Uskoro dostupno.", code: "stripe_not_connected" });
    }
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/escrow/verify
 * Verificira Stripe Checkout session i aktivira hold u bazi.
 * Body: { checkoutSessionId, conversationId }
 */
router.post("/verify", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { checkoutSessionId, conversationId } = req.body as {
      checkoutSessionId?: string;
      conversationId?: string;
    };
    const userId = req.userId!;

    if (!checkoutSessionId || !conversationId) {
      return res.status(400).json({ error: "checkoutSessionId i conversationId su obvezni" });
    }

    const stripe = await getUncachableStripeClient();
    const session = await stripe.checkout.sessions.retrieve(checkoutSessionId);

    if (session.payment_status !== "paid") {
      return res.status(402).json({ error: "Plaćanje nije završeno", paymentStatus: session.payment_status });
    }

    const paymentIntentId = typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;

    await db
      .update(escrowDepositsTable)
      .set({
        status: "held",
        paymentIntentId: paymentIntentId ?? null,
      })
      .where(and(
        eq(escrowDepositsTable.conversationId, conversationId),
        eq(escrowDepositsTable.userId, userId),
        eq(escrowDepositsTable.checkoutSessionId, checkoutSessionId)
      ));

    // Activate escrow on conversation
    await db
      .update(conversationsTable)
      .set({ escrowActive: true })
      .where(eq(conversationsTable.id, conversationId));

    return res.json({ status: "held", paymentIntentId });
  } catch (err) {
    req.log.error({ err }, "Escrow verify failed");
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

/**
 * POST /api/escrow/confirm/:conversationId
 * Korisnik potvrđuje da je primio paket.
 * Ako obje strane potvrde — oba depozita se otpuštaju.
 */
router.post("/confirm/:conversationId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const conversationId = req.params["conversationId"] as string;
    const userId = req.userId!;

    const participant = await getConversationParticipant(conversationId, userId);
    if (!participant) {
      return res.status(403).json({ error: "Nisi sudionik ove konverzacije" });
    }

    // Mark my deposit as confirmed
    await db
      .update(escrowDepositsTable)
      .set({ status: "confirmed", confirmedAt: new Date() })
      .where(and(
        eq(escrowDepositsTable.conversationId, conversationId),
        eq(escrowDepositsTable.userId, userId)
      ));

    const released = await tryReleaseDeposits(conversationId);

    // Build status response
    const deposits = await db
      .select()
      .from(escrowDepositsTable)
      .where(eq(escrowDepositsTable.conversationId, conversationId));

    const myDeposit = deposits.find((d) => d.userId === userId);
    const theirDeposit = deposits.find((d) => d.userId !== userId);

    return res.json({
      myStatus: myDeposit?.status ?? "none",
      theirStatus: theirDeposit?.status ?? "none",
      bothConfirmed: deposits.length === 2 && deposits.every((d) => ["confirmed", "released"].includes(d.status)),
      released,
    });
  } catch (err) {
    req.log.error({ err }, "Escrow confirm failed");
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

/**
 * GET /api/escrow/status/:conversationId
 * Status depozita za ovu konverzaciju.
 */
router.get("/status/:conversationId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const conversationId = req.params["conversationId"] as string;
    const userId = req.userId!;

    const participant = await getConversationParticipant(conversationId, userId);
    if (!participant) {
      return res.status(403).json({ error: "Nisi sudionik ove konverzacije" });
    }

    const deposits = await db
      .select()
      .from(escrowDepositsTable)
      .where(eq(escrowDepositsTable.conversationId, conversationId));

    const myDeposit = deposits.find((d) => d.userId === userId);
    const theirDeposit = deposits.find((d) => d.userId !== userId);

    const bothHeld = deposits.length === 2
      && deposits.every((d) => ["held", "confirmed", "released"].includes(d.status));
    const bothConfirmed = deposits.length === 2
      && deposits.every((d) => ["confirmed", "released"].includes(d.status));
    const released = deposits.every((d) => d.status === "released");

    return res.json({
      myStatus: myDeposit?.status ?? "none",
      theirStatus: theirDeposit?.status ?? "none",
      myCheckoutSessionId: myDeposit?.checkoutSessionId ?? null,
      bothHeld,
      bothConfirmed,
      released,
      myAmount: myDeposit?.amount ?? 0,
      theirAmount: theirDeposit?.amount ?? 0,
      currency: ESCROW_CURRENCY,
    });
  } catch (err) {
    req.log.error({ err }, "Escrow status check failed");
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

/**
 * POST /api/escrow/capture/:conversationId
 * Admin: naplati depozit (kazna) — koristi se u slučaju spora.
 */
router.post("/capture/:conversationId", requireAuth, async (req: AuthRequest, res) => {
  try {
    const conversationId = req.params["conversationId"] as string;
    const { targetUserId } = req.body as { targetUserId?: string };

    const participant = await getConversationParticipant(conversationId, req.userId!);
    if (!participant) return res.status(403).json({ error: "Nisi sudionik" });

    const whereUserId = targetUserId ?? req.userId!;
    const deposits = await db
      .select()
      .from(escrowDepositsTable)
      .where(and(
        eq(escrowDepositsTable.conversationId, conversationId),
        eq(escrowDepositsTable.userId, whereUserId)
      ))
      .limit(1);

    const deposit = deposits[0];
    if (!deposit?.paymentIntentId) return res.status(404).json({ error: "Depozit nije pronađen" });

    const stripe = await getUncachableStripeClient();
    const captured = await stripe.paymentIntents.capture(deposit.paymentIntentId);

    await db
      .update(escrowDepositsTable)
      .set({ status: "captured" })
      .where(eq(escrowDepositsTable.id, deposit.id));

    return res.json({ status: "captured", paymentIntentId: captured.id });
  } catch (err) {
    req.log.error({ err }, "Escrow capture failed");
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

export default router;
