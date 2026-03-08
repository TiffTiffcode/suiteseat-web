// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {},

  async rewrites() {
    return {
      beforeFiles: [
        { source: '/admin', destination: '/admin.html' },
        { source: '/client-dashboard', destination: '/client-dashboard.html' },
        { source: '/appointment-settings', destination: '/appointment-settings.html' },
        { source: '/calendar', destination: '/calendar.html' },
        { source: '/checkout', destination: '/checkout.html' },
        { source: '/clients', destination: '/clients.html' },
        { source: '/course-settings', destination: '/course-settings.html' },
        { source: '/index', destination: '/index.html' },
        { source: '/linkpage-settings', destination: '/linkpage-settings.html' },
        { source: '/menu', destination: '/menu.html' },
        { source: '/payInvoice', destination: '/payInvoice.html' },
        { source: '/settings', destination: '/settings.html' },
        { source: '/store-settings', destination: '/store-settings.html' },
        { source: '/suite-settings', destination: '/suite-settings.html' },
        { source: '/template', destination: '/template.html' },
        { source: '/availability', destination: '/availability.html' },
      ],

      afterFiles: [
        { source: '/:slug.json', destination: 'http://localhost:8400/:slug.json' },

        { source: '/api/:path*', destination: 'http://localhost:8400/api/:path*' },
        { source: '/public/:path*', destination: 'http://localhost:8400/public/:path*' },
        { source: '/uploads/:path*', destination: 'http://localhost:8400/uploads/:path*' },

        { source: '/check-login', destination: 'http://localhost:8400/check-login' },
        { source: '/login', destination: 'http://localhost:8400/login' },
        { source: '/logout', destination: 'http://localhost:8400/logout' },
        { source: '/auth/:path*', destination: 'http://localhost:8400/auth/:path*' },
        { source: '/change-password', destination: 'http://localhost:8400/change-password' },
      ],
    };
  },
};

export default nextConfig;