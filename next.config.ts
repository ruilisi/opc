import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['qiniu', 'urllib', 'proxy-agent'],
};

export default nextConfig;
