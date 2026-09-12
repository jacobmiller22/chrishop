import { withPayload } from '@payloadcms/next/withPayload';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@chrishop/ui', '@chrishop/types', '@chrishop/notifications'],
  serverExternalPackages: ['@libsql/client', 'drizzle-orm', 'node:sqlite'],
  images: {
    loader: 'custom',
    loaderFile: './src/lib/image-loader.ts',
    remotePatterns: [
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
