import type { NextConfig } from "next";

// Dev-harness config. Never wired into the production build — the app builds
// from apps/storefront, which has its own next.config.ts.
const config: NextConfig = {
  transpilePackages: ["@plaspool/ui", "@plaspool/brand", "@plaspool/web", "@plaspool/blog"],
  images: { unoptimized: true },
  async rewrites() {
    // The harness has no `/images/blog/[id]` route of its own — that proxy
    // lives in apps/storefront. Map the same path straight to the API; the
    // upstream 302 passes through to the browser, which keeps the redirect
    // hop in dev only. `imageUrl()` emits this path everywhere.
    return [
      {
        source: "/images/blog/:id",
        destination: "https://admin.plaspool.com/api/public/images/:id",
      },
    ];
  },
};

export default config;
