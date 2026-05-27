import { Router } from "express";
import { getUncachableStripeClient, getStripePublishableKey } from "../stripeClient";

const router = Router();

const PLATFORM_FEE_CENTS = 150;

/**
 * GET /api/payments/publishable-key
 */
router.get("/publishable-key", async (req, res) => {
  try {
    const key = await getStripePublishableKey();
    return res.json({ publishableKey: key });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch publishable key");
    return res.status(503).json({ error: "Stripe nije spojen.", code: "stripe_not_connected" });
  }
});

/**
 * POST /api/payments/checkout
 * Kreira Stripe Checkout Session za plaćanje dostave.
 * Body: { conversationId, listingId, methodName, amountCents, successUrl, cancelUrl, sendcloudMethodId? }
 */
router.post("/checkout", async (req, res) => {
  try {
    const {
      conversationId,
      listingId,
      methodName,
      amountCents,
      successUrl,
      cancelUrl,
      sendcloudMethodId,
    } = req.body as {
      conversationId?: string;
      listingId?: string;
      methodName?: string;
      amountCents?: number;
      successUrl?: string;
      cancelUrl?: string;
      sendcloudMethodId?: number;
    };

    if (!conversationId || !successUrl || !cancelUrl) {
      return res.status(400).json({ error: "Nedostaju obavezni parametri" });
    }

    const finalAmount = amountCents ?? 399;
    if (finalAmount < 100 || finalAmount > 5000) {
      return res.status(400).json({ error: "Iznos dostave izvan dopuštenog raspona." });
    }

    const label = methodName ?? "Kurirska dostava";
    const totalCents = finalAmount + PLATFORM_FEE_CENTS;

    const stripe = await getUncachableStripeClient();

    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Dostava — ${label}`,
              description: "Plaćanje dostavne usluge putem Trampaj.hr platforme",
            },
            unit_amount: totalCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        conversationId: conversationId ?? "",
        listingId: listingId ?? "",
        methodName: label,
        shippingAmountCents: String(finalAmount),
        platformFee: String(PLATFORM_FEE_CENTS),
        sendcloudMethodId: sendcloudMethodId ? String(sendcloudMethodId) : "",
        type: "shipping_payment",
      },
    });

    return res.json({
      sessionId: session.id,
      url: session.url,
      amount: totalCents,
      shippingAmount: finalAmount,
      platformFee: PLATFORM_FEE_CENTS,
      currency: "eur",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "Checkout session creation failed");
    if (message.includes("not connected") || message.includes("Missing Replit")) {
      return res.status(503).json({ error: "Stripe nije spojen. Uskoro dostupno.", code: "stripe_not_connected" });
    }
    return res.status(500).json({ error: message });
  }
});

export default router;
