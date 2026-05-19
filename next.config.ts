import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  async redirects() {
    return [
      {
        source: "/manifest.json",
        destination: "/tys-table-app.webmanifest",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
