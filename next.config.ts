import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A self-contained server in .next/standalone (no node_modules install needed), used
  // for running on the Raspberry Pi. See scripts/build-pi.sh.
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // The illustration API reads these files at runtime; make sure production builds ship them.
  outputFileTracingIncludes: {
    "/api/illustrations": ["./src/features/illustrations/library/**/*"],
    "/api/illustrations/*": ["./src/features/illustrations/library/**/*"],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
