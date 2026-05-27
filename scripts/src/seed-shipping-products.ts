import Stripe from "stripe";

async function getStripeClient(): Promise<Stripe> {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? "repl " + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
      ? "depl " + process.env.WEB_REPL_RENEWAL
      : null;

  if (!hostname || !xReplitToken) {
    throw new Error("Missing Replit environment variables. Run this from the Replit environment.");
  }

  const url = new URL(`https://${hostname}/api/v2/connection`);
  url.searchParams.set("include_secrets", "true");
  url.searchParams.set("connector_names", "stripe");
  url.searchParams.set("environment", "development");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json", "X-Replit-Token": xReplitToken },
  });
  const data = await response.json() as any;
  const settings = data.items?.[0]?.settings;

  if (!settings?.secret) throw new Error("Stripe not connected");

  return new Stripe(settings.secret, { apiVersion: "2025-08-27.basil" as any });
}

async function createProducts() {
  const stripe = await getStripeClient();

  const shippingProducts = [
    {
      name: "Dostava — Box Now paketomat",
      description: "Slanje putem Box Now paketomata — paketi do 20 kg",
      metadata: { type: "shipping", method: "boxnow", size: "small" },
      amount: 399,
    },
    {
      name: "Dostava — GLS kućna dostava",
      description: "Kurir dolazi na adresu — paketi do 31 kg",
      metadata: { type: "shipping", method: "gls", size: "medium" },
      amount: 599,
    },
  ];

  for (const p of shippingProducts) {
    const existing = await stripe.products.search({
      query: `name:'${p.name}'`,
    });

    if (existing.data.length > 0) {
      console.log(`✓ Already exists: ${p.name}`);
      const prices = await stripe.prices.list({ product: existing.data[0].id, active: true });
      if (prices.data.length > 0) {
        console.log(`  Price: ${prices.data[0].unit_amount! / 100}€ (${prices.data[0].id})`);
      }
      continue;
    }

    const product = await stripe.products.create({
      name: p.name,
      description: p.description,
      metadata: p.metadata,
    });

    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: p.amount,
      currency: "eur",
    });

    console.log(`✅ Created: ${p.name}`);
    console.log(`   Product ID: ${product.id}`);
    console.log(`   Price ID:   ${price.id} (${p.amount / 100}€)`);
  }

  console.log("\nDone!");
}

createProducts().catch(console.error);
