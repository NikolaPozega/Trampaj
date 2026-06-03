import { logger } from "./logger";

export async function sendTelegramMessage(text: string): Promise<boolean> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  const chatId = process.env["TELEGRAM_CHAT_ID"];
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
    });
    if (!res.ok) {
      const err = await res.text();
      logger.error({ err }, "Telegram send failed");
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err }, "Telegram send error");
    return false;
  }
}
