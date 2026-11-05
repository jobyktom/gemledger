import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@gemledger/shared"],
  // Cache Components is off for now: almost every portal page depends on the
  // signed-in user, so pages render per request. Revisit for the public pages.
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
