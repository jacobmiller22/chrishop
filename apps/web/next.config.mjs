import { withPayload } from '@payloadcms/next/withPayload';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@chrishop/ui', '@chrishop/types', '@chrishop/notifications'],
  serverExternalPackages: ['@libsql/client', 'drizzle-orm', 'node:sqlite'],
  images: {
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
};

export default withPayload(nextConfig);
