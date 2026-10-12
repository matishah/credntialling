import type { NextConfig } from "next";

// cacheComponents/partialPrefetching are intentionally off: every page here is
// per-user and holds PHI, so we render on each request and never cache output.
const nextConfig: NextConfig = {
  // Default bottom-left badge sits on top of the sidebar's user/sign-out row.
  devIndicators: { position: "bottom-right" },
  experimental: {
    agentFeedback: true,
    serverActions: {
      bodySizeLimit: "60mb", // onboarding form can carry a provider's whole document set (15 MB per file)
    },
    // proxy.ts makes Next buffer request bodies; anything past this is silently cut off, so keep it >= the limit above
    proxyClientMaxBodySize: "60mb",
  },
  serverExternalPackages: ["@electric-sql/pglite", "pg"],
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
