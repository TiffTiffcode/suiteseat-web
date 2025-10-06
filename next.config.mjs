/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    // Send "/" to your static landing page in /public
    return [{ source: '/', destination: '/index.html', permanent: false }];
  },
};

export default nextConfig;
