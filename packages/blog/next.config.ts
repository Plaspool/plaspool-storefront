import type { NextConfig } from "next";

// Dev-harness config. Never wired into the production build — the app builds
// from apps/storefront, which has its own next.config.ts.
const config: NextConfig = {
  transpilePackages: ["@plaspool/ui", "@plaspool/brand", "@plaspool/web", "@plaspool/blog"],
  images: { unoptimized: true },
};

export default config;
