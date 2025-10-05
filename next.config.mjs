/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true }, // you can switch this off later
  // output: 'standalone', // optional
};
export default nextConfig;
