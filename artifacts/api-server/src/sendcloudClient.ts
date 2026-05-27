const SENDCLOUD_API = "https://panel.sendcloud.sc/api/v2";

export function isSendcloudConfigured(): boolean {
  return !!(process.env.SENDCLOUD_PUBLIC_KEY && process.env.SENDCLOUD_SECRET_KEY);
}

function getAuthHeader(): string {
  const pub = process.env.SENDCLOUD_PUBLIC_KEY;
  const sec = process.env.SENDCLOUD_SECRET_KEY;
  if (!pub || !sec) throw new Error("SENDCLOUD_NOT_CONFIGURED");
  return "Basic " + Buffer.from(`${pub}:${sec}`).toString("base64");
}

export async function sendcloudGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(`${SENDCLOUD_API}${path}`, {
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Sendcloud GET ${path}: ${res.status} — ${body}`);
  }
  return res.json() as Promise<T>;
}

export async function sendcloudPost<T = unknown>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${SENDCLOUD_API}${path}`, {
    method: "POST",
    headers: {
      Authorization: getAuthHeader(),
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Sendcloud POST ${path}: ${res.status} — ${errBody}`);
  }
  return res.json() as Promise<T>;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SendcloudMethod {
  id: number;
  name: string;
  carrier: string;
  minWeight: number;
  maxWeight: number;
  deliveryDays: number | null;
  priceEur: number;
}

export interface SendcloudParcelInput {
  name: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  email: string;
  weight: string;
  shippingMethodId: number;
  orderNumber?: string;
}
