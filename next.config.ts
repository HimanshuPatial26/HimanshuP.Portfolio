import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React Bits WebGL components call loseContext() on unmount. Strict Mode's
  // dev-only double mount then leaves them drawing into a dead context, so
  // turn it off to make dev match production.
  reactStrictMode: false,
  cacheComponents: true,
  partialPrefetching: true,
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
