// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const base = process.env.NEXT_PUBLIC_LIVE_BASE || "http://localhost:8400";
    return [
      { source: "/socket.io/:path*", destination: `${base}/socket.io/:path*` },
    ];
  },
};

export default nextConfig;
