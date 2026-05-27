import { Router } from "express";
import { getUncachableStripeClient, getStripePublishableKey } from "../stripeClient";

const router = Router();

const SHIPPING_PRICES: Record<string, { amount: number; label: string }> = {
  small: { amount: 399, label: "Box Now paketomat" },
  medium: { amount: 599, label: "GLS kućna dostava" },
};

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
 * Body: { conversationId, listingId, packageSize: "small"|"medium", successUrl, cancelUrl }
 */
router.post("/checkout", async (req, res) => {
  try {
    const { conversationId, listingId, packageSize, successUrl, cancelUrl } = req.body as {
      conversationId?: string;
      listingId?: string;
      packageSize?: string;
      successUrl?: string;
      cancelUrl?: string;
    };

    if (!conversationId || !packageSize || !successUrl || !cancelUrl) {
      return res.status(400).json({ error: "Nedostaju obavezni parametri" });
    }

    const pricing = SHIPPING_PRICES[packageSize];
    if (!pricing) {
      return res.status(400).json({ error: `Nepoznata veličina paketa: ${packageSize}` });
    }

    const stripe = await getUncachableStripeClient();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            product_data: {
              name: `Dostava — ${pricing.label}`,
              description: "Plaćanje dostavne usluge putem Trampaj.hr platforme",
            },
            unit_amount: pricing.amount,
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
        packageSize,
        platformFee: String(PLATFORM_FEE_CENTS),
        type: "shipping_payment",
      },
    });

    return res.json({
      sessionId: session.id,
      url: session.url,
      amount: pricing.amount,
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

/**
 * GET /api/payments/shipping-price/:packageSize
 * Vraća cijenu dostave za zadanu veličinu paketa.
 */
router.get("/shipping-price/:packageSize", (req, res) => {
  const { packageSize } = req.params;
  const pricing = SHIPPING_PRICES[packageSize];
  if (!pricing) {
    return res.status(404).json({ error: "Nepoznata veličina paketa" });
  }
  return res.json({
    packageSize,
    amount: pricing.amount,
    amountEur: (pricing.amount / 100).toFixed(2),
    label: pricing.label,
    platformFee: PLATFORM_FEE_CENTS,
  });
});

export default router;
