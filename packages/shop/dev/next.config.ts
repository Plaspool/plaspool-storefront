import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@plaspool/ui", "@plaspool/brand", "@plaspool/web", "@plaspool/blog", "@plaspool/shop"],
  images: { unoptimized: true },
};

export default config;
