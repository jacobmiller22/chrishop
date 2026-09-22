import { withPayload } from '@payloadcms/next/withPayload';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  transpilePackages: ['@chrishop/ui', '@chrishop/types', '@chrishop/notifications'],
  serverExternalPackages: ['@libsql/client', 'drizzle-orm'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'media.chrishop.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.chrishop.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'media.chrishop.jacobmiller22.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.jacobmiller22.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.r2.cloudflarestorage.com',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        pathname: '/**',
      },
      {
        protocol: 'http',
        hostname: '127.0.0.1',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; frame-src 'self' https://challenges.cloudflare.com;",
          },
        ],
      },
      {
        source: '/products',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=10, stale-while-revalidate=50',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, s-maxage=10, stale-while-revalidate=50',
          },
          {
            key: 'Cloudflare-CDN-Cache-Control',
            value: 'public, s-maxage=10, stale-while-revalidate=50',
          },
        ],
      },
      {
        source: '/products/:slug*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, s-maxage=10, stale-while-revalidate=50',
          },
          {
            key: 'CDN-Cache-Control',
            value: 'public, s-maxage=10, stale-while-revalidate=50',
          },
          {
            key: 'Cloudflare-CDN-Cache-Control',
            value: 'public, s-maxage=10, stale-while-revalidate=50',
          },
        ],
      },
    ];
  },
};

export default withPayload(nextConfig);
