/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@workspace/database", "@workspace/ui"],
};

export default nextConfig;
