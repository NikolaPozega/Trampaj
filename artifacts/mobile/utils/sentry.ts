import * as Sentry from "@sentry/react-native";

const DSN = process.env["EXPO_PUBLIC_SENTRY_DSN"] ?? "";

export function initSentry() {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? "development" : "production",
    tracesSampleRate: 0.2,
    enableNativeFramesTracking: true,
  });
}

export { Sentry };
