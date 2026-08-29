import type { NextConfig } from 'next';

const API_ORIGIN = process.env.API_URL ?? 'http://127.0.0.1:3001';

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
