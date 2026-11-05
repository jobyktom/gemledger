// Plain JavaScript (not next.config.ts) so Next.js can load it without the
// native SWC binary: Hostinger's build servers have a glibc too old for it.

/** @type {import("next").NextConfig} */
const nextConfig = {
  transpilePackages: ["@gemledger/shared"],
  // Cache Components is off for now: almost every portal page depends on the
  // signed-in user, so pages render per request. Revisit for the public pages.
};

export default nextConfig;
