import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
