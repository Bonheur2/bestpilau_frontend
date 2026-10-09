/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // The old Admin page was split into Menu and Settings
  async redirects() {
    return [{ source: '/admin', destination: '/settings', permanent: false }];
  },
};

export default nextConfig;
