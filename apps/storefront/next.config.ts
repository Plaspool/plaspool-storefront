import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@plaspool/ui", "@plaspool/brand", "@plaspool/web", "@plaspool/blog", "@plaspool/shop"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: `${process.env.WORDPRESS_HOSTNAME}`,
        port: "",
        pathname: '/wp-content/uploads/**',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/admin",
        destination: `${process.env.WORDPRESS_URL}/wp-admin`,
        permanent: true,
      },
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
