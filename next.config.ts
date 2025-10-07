// next.config.ts
/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
    ];
  },
};
module.exports = nextConfig;
