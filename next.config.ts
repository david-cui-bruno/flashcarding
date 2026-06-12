import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The dev-only indicator badge overlaps the bottom-left sidebar profile; hide it.
  devIndicators: false,
  experimental: {
    serverActions: {
      // PDF/Word uploads flow through a Server Action; the default body limit is
      // 1MB. Raise it so real documents go through. See lib/ingestion/.
      bodySizeLimit: "25mb",
    },
  },
  // The ingestion adapter (lib/ingestion) uses process.cwd() to locate the
  // Python sidecar it spawns at runtime. The file tracer can't follow that and
  // over-traces the /new route (pulling in next.config itself). The sidecar is a
  // separate venv invoked by path — never a bundled dependency — so exclude it
  // and the config from /new's server trace.
  outputFileTracingExcludes: {
    "/new": ["./services/**/*", "./next.config.ts"],
  },
  async headers() {
    return [
      {
        // Baseline security headers on every route.
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        // The service worker must never be cached, or push/install updates stick.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
