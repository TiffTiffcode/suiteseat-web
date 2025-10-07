// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  eslint: {
    // ✅ don’t run ESLint during `next build`
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
