/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:6400';
    const bookingOrigin = process.env.BOOKING_ORIGIN || 'http://localhost:8400';

 return [
      // ✅ API proxy (specific first)
      { source: '/api/public/:path*', destination: `${apiBase}/public/:path*` },
      { source: '/api/:path*',        destination: `${apiBase}/api/:path*` },

      // Legacy static HTML routes (keep while migrating)
      { source: '/', destination: '/index.html' },
      { source: '/signup', destination: '/signup.html' },
      { source: '/api/login',  destination: `${apiBase}/login` },
      { source: '/api/logout', destination: `${apiBase}/logout` },
      { source: '/admin', destination: '/admin.html' },
      { source: '/appointment-settings', destination: '/appointment-settings.html' },
      { source: '/availability', destination: '/availability.html' },
      { source: '/calendar', destination: '/calendar.html' },
      { source: '/client-dashboard', destination: '/client-dashboard.html' },
      { source: '/clients', destination: '/clients.html' },
      { source: '/menu', destination: '/menu.html' },
      { source: '/uploads/:path*', destination: `${apiBase}/uploads/:path*` },

      // Catch-all → legacy origin, but EXCLUDE /r/* so Next can serve our new React route
      {
        source:
          '/:slug((?!api|_next|qassets|uploads|r(?:/|$)|favicon\\.ico|robots\\.txt|sitemap\\.xml|.*\\..*).*)',
        destination: `${bookingOrigin}/:slug`,
      },
    ];
  },
};

module.exports = nextConfig;
