/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@chrishop/ui', '@chrishop/types', '@chrishop/notifications'],
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
