// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://8353ab13affd36be8dd454f81afd0a93@o4510865217814528.ingest.us.sentry.io/4510865218076672",

  // Sample 10% of traces in production (1.0 = 100% is very expensive)
  tracesSampleRate: 0.1,

  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Disable PII collection — HIPAA compliance for healthcare data
  sendDefaultPii: false,
});
