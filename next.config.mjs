// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},

  async rewrites() {
    return [
      // Public JSON
      { source: '/:slug.json', destination: 'http://localhost:8400/:slug.json' },

      // Your existing proxies
      { source: '/api/:path*',     destination: 'http://localhost:8400/api/:path*' },
      { source: '/public/:path*',  destination: 'http://localhost:8400/public/:path*' },
      { source: '/uploads/:path*', destination: 'http://localhost:8400/uploads/:path*' },

      // 🔴 Add these so login status & auth hit 8400, not Next
      { source: '/check-login',     destination: 'http://localhost:8400/check-login' },
      { source: '/login',           destination: 'http://localhost:8400/login' },
      { source: '/logout',          destination: 'http://localhost:8400/logout' },
      { source: '/auth/:path*',     destination: 'http://localhost:8400/auth/:path*' },
      { source: '/change-password', destination: 'http://localhost:8400/change-password' },
    ];
  },
};

export default nextConfig;
