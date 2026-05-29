import { Resend } from "resend";
import { logger } from "./logger";

const RESEND_API_KEY = process.env["RESEND_API_KEY"] ?? "";
const ALERT_EMAIL = process.env["ALERT_EMAIL"] ?? "";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!RESEND_API_KEY) return null;
  if (!resend) resend = new Resend(RESEND_API_KEY);
  return resend;
}

export async function sendAlertEmail(subject: string, body: string): Promise<void> {
  if (!RESEND_API_KEY || !ALERT_EMAIL) {
    logger.warn("Alert email not configured (RESEND_API_KEY or ALERT_EMAIL missing)");
    return;
  }
  const client = getResend();
  if (!client) return;

  try {
    await client.emails.send({
      from: "Trampaj Monitor <onboarding@resend.dev>",
      to: ALERT_EMAIL,
      subject: `🚨 Trampaj Alert: ${subject}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;">
          <div style="background:#08152E;padding:16px 24px;border-radius:8px 8px 0 0;">
            <h2 style="color:#F5C100;margin:0;font-size:18px;">🚨 Trampaj Monitor</h2>
          </div>
          <div style="background:#f9fafb;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <h3 style="color:#111;margin-top:0;">${subject}</h3>
            <pre style="background:#fff;border:1px solid #e5e7eb;padding:12px;border-radius:6px;font-size:13px;white-space:pre-wrap;">${body}</pre>
            <p style="color:#6b7280;font-size:12px;margin-bottom:0;">
              Vrijeme: ${new Date().toLocaleString("hr-HR", { timeZone: "Europe/Zagreb" })}<br>
              Server: Trampaj API (swap-items--nikola120.replit.app)
            </p>
          </div>
        </div>
      `,
    });
    logger.info({ subject }, "Alert email sent");
  } catch (err) {
    logger.error({ err }, "Failed to send alert email");
  }
}
