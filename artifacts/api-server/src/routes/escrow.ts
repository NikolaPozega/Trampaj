import { Router } from "express";
import { getUncachableStripeClient } from "../stripeClient";

const router = Router();

const ESCROW_AMOUNT_CENTS = 500;
const ESCROW_CURRENCY = "eur";

/**
 * POST /api/escrow/intent
 * Kreira PaymentIntent s manual capture (hold na kartici).
 * Prihvaća: { tradeId, userName, description }
 * Vraća: { clientSecret, paymentIntentId }
 */
router.post("/intent", async (req, res) => {
  try {
    const { tradeId, userName, description } = req.body as {
      tradeId?: string;
      userName?: string;
      description?: string;
    };

    if (!tradeId || !userName) {
      return res.status(400).json({ error: "tradeId i userName su obvezni" });
    }

    const stripe = await getUncachableStripeClient();

    const paymentIntent = await stripe.paymentIntents.create({
      amount: ESCROW_AMOUNT_CENTS,
      currency: ESCROW_CURRENCY,
      capture_method: "manual",
      description: description ?? `Zaštita trampe — ${tradeId}`,
      metadata: {
        tradeId,
        userName,
        type: "escrow_deposit",
      },
    });

    return res.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: ESCROW_AMOUNT_CENTS,
      currency: ESCROW_CURRENCY,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "Escrow intent creation failed");
    if (message.includes("integration not connected") || message.includes("Missing Replit")) {
      return res.status(503).json({ error: "Stripe nije spojen. Uskoro dostupno.", code: "stripe_not_connected" });
    }
    return res.status(500).json({ error: message });
  }
});

/**
 * POST /api/escrow/capture/:paymentIntentId
 * Uhvati (naplati) hold — poziva se kada obje strane potvrde primitak paketa.
 */
router.post("/capture/:paymentIntentId", async (req, res) => {
  try {
    const { paymentIntentId } = req.params;
    const stripe = await getUncachableStripeClient();

    const captured = await stripe.paymentIntents.capture(paymentIntentId);

    return res.json({
      status: captured.status,
      paymentIntentId: captured.id,
    });
  } catch (err) {
    req.log.error({ err }, "Escrow capture failed");
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

/**
 * POST /api/escrow/cancel/:paymentIntentId
 * Otkaži hold (vraća puni iznos) — koristi se ako trampa propadne.
 */
router.post("/cancel/:paymentIntentId", async (req, res) => {
  try {
    const { paymentIntentId } = req.params;
    const stripe = await getUncachableStripeClient();

    const cancelled = await stripe.paymentIntents.cancel(paymentIntentId);

    return res.json({
      status: cancelled.status,
      paymentIntentId: cancelled.id,
    });
  } catch (err) {
    req.log.error({ err }, "Escrow cancel failed");
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

/**
 * GET /api/escrow/:paymentIntentId
 * Status escrow depozita.
 */
router.get("/:paymentIntentId", async (req, res) => {
  try {
    const { paymentIntentId } = req.params;
    const stripe = await getUncachableStripeClient();

    const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

    return res.json({
      paymentIntentId: pi.id,
      status: pi.status,
      amount: pi.amount,
      currency: pi.currency,
      metadata: pi.metadata,
    });
  } catch (err) {
    req.log.error({ err }, "Escrow status check failed");
    return res.status(500).json({ error: err instanceof Error ? err.message : "Unknown error" });
  }
});

export default router;
