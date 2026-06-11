import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
};

export default nextConfig;
