import type { NextConfig } from 'next';

// In Docker, API_INTERNAL_URL is the Compose service (http://api:3001).
// API_URL is the public origin used by browsers and payment gateways.
const API_ORIGIN =
  process.env.API_INTERNAL_URL ?? process.env.API_URL ?? 'http://127.0.0.1:3001';

const nextConfig: NextConfig = {
  transpilePackages: ['@avyro/ui'],
  async rewrites() {
    // Same-origin proxy so auth cookies work in the browser
    return [
      {
        source: '/api/:path*',
        destination: `${API_ORIGIN}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
