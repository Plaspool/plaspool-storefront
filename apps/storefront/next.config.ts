import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@plaspool/ui", "@plaspool/brand", "@plaspool/web", "@plaspool/blog"],
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
