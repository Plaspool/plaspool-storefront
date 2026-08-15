import type { NextConfig } from "next";

const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  transpilePackages: ["@plaspool/ui", "@plaspool/brand", "@plaspool/web", "@plaspool/blog", "@plaspool/shop"],
  experimental: {
    // Barrel-export packages pulled in wholesale via transpilePackages inflate
    // First Load JS on every route that imports from them; this makes Next
    // trace and tree-shake the actual imports instead of the full re-export.
    optimizePackageImports: ["@plaspool/ui", "@plaspool/brand", "@plaspool/web", "@plaspool/blog", "@plaspool/shop"],
  },
  images: {
    // Cloudflare Workers has no sharp, so on-the-fly optimisation is not
    // available there. This is not currently a loss: no code path passes a
    // remote URL to next/image today — blog covers use a plain <img> with an
    // explicit @next/next/no-img-element disable (see packages/blog), and
    // next/image only appears in packages/web/src/pages/landing.tsx with
    // local, build-time-known assets. If a future blog cover switches to
    // next/image, it will need this loader disabled or a custom loader —
    // there is no remote pattern configured to fall back on.
    unoptimized: true,
  },
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [
          {
            type: "host",
            value: "www.plaspool.com",
          },
        ],
        destination: "https://plaspool.com/:path*",
        permanent: true,
      }
    ];
  },
};

export default nextConfig;
