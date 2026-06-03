import * as Sentry from "@sentry/node";
import { logger } from "./logger";

const SENTRY_DSN = process.env["SENTRY_DSN"] ?? "";

export function initSentry() {
  if (!SENTRY_DSN) {
    logger.warn("Sentry DSN nije postavljen — greške se ne šalju na Sentry");
    return;
  }
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: process.env["NODE_ENV"] ?? "production",
    tracesSampleRate: 0.1,
  });
  logger.info("Sentry inicijaliziran");
}

export { Sentry };
