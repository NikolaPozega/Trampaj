import * as Sentry from "@sentry/react-native";

const DSN = process.env["EXPO_PUBLIC_SENTRY_DSN"] ?? "";

export function initSentry() {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? "development" : "production",
    tracesSampleRate: 0.2,
    enableNativeFramesTracking: true,
    beforeSend(event) {
      const exc = event.exception?.values?.[0];
      const message = exc?.value ?? event.message ?? "(no message)";
      const stack = exc?.stacktrace?.frames
        ?.map((f) => `  at ${f.function ?? "?"} (${f.filename ?? "?"}:${f.lineno ?? "?"}:${f.colno ?? "?"})`)
        .reverse()
        .join("\n") ?? "(no stack)";
      // eslint-disable-next-line no-console
      console.error(`CRITICAL MOBILE RUNTIME ERROR: ${message}\n${stack}`);
      return event;
    },
  });
}

export { Sentry };
