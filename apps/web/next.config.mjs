/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@chrishop/ui', '@chrishop/types', '@chrishop/notifications'],
};

export default nextConfig;
