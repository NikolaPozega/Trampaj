import { Router } from "express";
import { isSendcloudConfigured, sendcloudGet, sendcloudPost, type SendcloudMethod, type SendcloudParcelInput } from "../sendcloudClient";
import { requireAuth, type AuthRequest } from "../middlewares/auth";

const router = Router();

const PLATFORM_FEE_CENTS = 150;

// Fallback kad Sendcloud nije konfiguriran
const FALLBACK_METHODS: SendcloudMethod[] = [
  { id: -1, name: "Box Now paketomat", carrier: "boxnow", minWeight: 0.1, maxWeight: 20, deliveryDays: 2, priceEur: 3.99 },
  { id: -2, name: "GLS kućna dostava", carrier: "gls", minWeight: 0.1, maxWeight: 31.5, deliveryDays: 2, priceEur: 5.99 },
  { id: -3, name: "DPD kućna dostava", carrier: "dpd", minWeight: 0.1, maxWeight: 31.5, deliveryDays: 2, priceEur: 5.99 },
];

interface RawSendcloudMethod {
  id: number;
  name: string;
  carrier: string;
  min_weight: string;
  max_weight: string;
  lead_time_hours?: number;
  price?: { price: string };
}

/**
 * GET /api/sendcloud/methods
 * Vraća dostupne kurirske metode za HR.
 * Ako Sendcloud nije konfiguriran, vraća fallback listu.
 */
router.get("/methods", async (req, res) => {
  if (!isSendcloudConfigured()) {
    return res.json({
      methods: FALLBACK_METHODS,
      configured: false,
      platformFeeCents: PLATFORM_FEE_CENTS,
    });
  }

  try {
    const data = await sendcloudGet<{ shipping_methods: RawSendcloudMethod[] }>(
      "/shipping_methods?to_country=HR&from_country=HR"
    );

    const methods: SendcloudMethod[] = (data.shipping_methods ?? [])
      .filter((m) => m.id > 0)
      .map((m) => ({
        id: m.id,
        name: m.name,
        carrier: m.carrier,
        minWeight: parseFloat(m.min_weight) || 0,
        maxWeight: parseFloat(m.max_weight) || 31.5,
        deliveryDays: m.lead_time_hours ? Math.ceil(m.lead_time_hours / 24) : null,
        priceEur: m.price?.price ? parseFloat(m.price.price) : 0,
      }));

    return res.json({
      methods: methods.length > 0 ? methods : FALLBACK_METHODS,
      configured: true,
      platformFeeCents: PLATFORM_FEE_CENTS,
    });
  } catch (err) {
    req.log.error({ err }, "Sendcloud methods fetch failed");
    return res.json({
      methods: FALLBACK_METHODS,
      configured: false,
      platformFeeCents: PLATFORM_FEE_CENTS,
    });
  }
});

/**
 * POST /api/sendcloud/parcel
 * Kreira pošiljku u Sendcloud i vraća URL nalepnice.
 * Poziva se nakon što je korisnik platio dostavu.
 */
router.post("/parcel", requireAuth, async (req: AuthRequest, res) => {
  if (!isSendcloudConfigured()) {
    return res.status(503).json({
      error: "Sendcloud nije konfiguriran.",
      code: "sendcloud_not_configured",
    });
  }

  try {
    const {
      name,
      address,
      city,
      postalCode,
      country = "HR",
      email,
      weight = "1.000",
      shippingMethodId,
      orderNumber,
    } = req.body as Partial<SendcloudParcelInput>;

    if (!name || !address || !city || !postalCode || !email || !shippingMethodId) {
      return res.status(400).json({ error: "Nedostaju podaci o primatelju." });
    }

    const result = await sendcloudPost<{ parcel: { label?: { normal_printer?: string[] }; tracking_url?: string; tracking_number?: string } }>(
      "/parcels",
      {
        parcel: {
          name,
          address,
          city,
          postal_code: postalCode,
          country,
          email,
          weight,
          shipment: { id: shippingMethodId },
          order_number: orderNumber ?? "",
          request_label: true,
        },
      }
    );

    const labelUrl = result.parcel?.label?.normal_printer?.[0] ?? null;
    const trackingUrl = result.parcel?.tracking_url ?? null;
    const trackingNumber = result.parcel?.tracking_number ?? null;

    return res.json({ labelUrl, trackingUrl, trackingNumber });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "Sendcloud parcel creation failed");
    return res.status(500).json({ error: msg });
  }
});

export default router;
