/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // @influencer/ui ships TS source; Next transpiles it. types/db are prebuilt.
  transpilePackages: ['@influencer/ui'],
  webpack: (config) => {
    // Resolve `.js` import specifiers to TS source in transpiled workspace packages.
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      ...config.resolve.extensionAlias,
    };
    return config;
  },
};

export default nextConfig;
